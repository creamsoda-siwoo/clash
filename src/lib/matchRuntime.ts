// Runs matches entirely in the browser instead of on a Socket.io server.
// Bot matches never touch the network. PvP matches elect one of the two
// players' browsers as the "host" (it runs the authoritative simulation).
// Matchmaking uses a Postgres table (clash_pvp_queue) with an atomic
// conditional UPDATE to claim a waiting opponent (no transaction needed —
// Postgres row locking makes the claim race-safe). Live match state/actions
// are relayed over an ephemeral Supabase Realtime Broadcast channel keyed by
// the match id, never persisted to a table.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { CARDS } from '../constants';
import {
  createMatch, spawnBot, playCardLogic, tickMatch, botThink, rewardForResult,
  EngineMatch, EngineEvents, TICK_MS,
} from './matchEngine';

export interface MatchSnapshot {
  players: Record<string, any>;
  units: any[];
  projectiles: any[];
  effects: any[];
  bases: any[];
  towers: any[];
  matchState: any;
}

export interface MatchResultPayload { result: 'win' | 'lose' | 'draw'; trophyChange: number; goldChange: number }

export interface MatchCallbacks {
  onState: (snap: MatchSnapshot) => void;
  onDamageText: (x: number, y: number, amount: number, color: string) => void;
  onNotification: (message: string, color: string) => void;
  onMatchResult: (r: MatchResultPayload) => void;
}

export interface JoinParams {
  myId: string; name: string; deck: string[]; trophies: number; cardLevels: Record<string, number>;
}

function serialize(match: EngineMatch): MatchSnapshot {
  return {
    players: match.players,
    units: match.units,
    projectiles: match.projectiles,
    effects: match.effects,
    bases: [match.bases.red, match.bases.blue],
    towers: match.towers,
    matchState: match.matchState,
  };
}

export class MatchController {
  private match: EngineMatch | null = null;
  private myTeam: 'red' | 'blue' = 'blue';
  private myId = '';
  private isHost = false;
  private matchChannel: RealtimeChannel | null = null;
  private queueChannel: RealtimeChannel | null = null;
  private queueRowId: string | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private aiTimer: ReturnType<typeof setInterval> | null = null;
  private callbacks: MatchCallbacks;
  private ended = false;
  private lastSyncAt = 0;
  private lastRemoteSnapshot: MatchSnapshot | null = null;
  private opponentId: string | null = null;

  constructor(callbacks: MatchCallbacks) { this.callbacks = callbacks; }

  private events: EngineEvents = {
    damageText: (x, y, amount, color) => this.callbacks.onDamageText(x, y, amount, color),
    notification: (msg, color) => this.callbacks.onNotification(msg, color),
  };

  private pushLocalState() {
    if (!this.match) return;
    this.callbacks.onState(serialize(this.match));
  }

  private checkLocalGameOver() {
    if (!this.match || this.ended) return;
    if (this.match.matchState.status === 'GAMEOVER') {
      this.ended = true;
      this.callbacks.onMatchResult(rewardForResult(this.match.matchState.winner, this.myTeam));
      this.stopLoops();
    }
  }

  private startLocalLoops() {
    this.tickTimer = setInterval(() => {
      if (!this.match) return;
      tickMatch(this.match, this.events);
      this.pushLocalState();
      if (this.matchChannel) this.syncToPeer();
      this.checkLocalGameOver();
    }, TICK_MS);
    this.aiTimer = setInterval(() => {
      if (this.match) botThink(this.match, this.events);
    }, 500);
  }

  private stopLoops() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.aiTimer) clearInterval(this.aiTimer);
    this.tickTimer = null;
    this.aiTimer = null;
  }

  private syncToPeer() {
    if (!this.match || !this.matchChannel) return;
    const now = Date.now();
    const isFinal = this.match.matchState.status === 'GAMEOVER';
    if (!isFinal && now - this.lastSyncAt < 90) return; // throttle broadcasts to ~11/s
    this.lastSyncAt = now;
    this.matchChannel.send({ type: 'broadcast', event: 'state', payload: serialize(this.match) });
  }

  /** Starts a fully local match against an AI opponent. No network involved. */
  async joinBotMatch(params: JoinParams) {
    this.myId = params.myId;
    this.isHost = true;
    this.myTeam = 'blue';
    const match = createMatch('local_' + Date.now(), false);
    match.players[params.myId] = {
      id: params.myId, team: 'blue', name: params.name, mana: 5, isBot: false,
      deck: params.deck, trophies: params.trophies, cardLevels: params.cardLevels, userId: params.myId,
    };
    spawnBot(match, 'red', params.trophies, params.cardLevels);
    this.match = match;
    this.pushLocalState();
    this.startLocalLoops();
  }

  /**
   * Tries to pair with another player waiting in the matchmaking queue for
   * `waitMs`. Falls back to a bot match if nobody is found in time, mirroring
   * the old server's "instant PvP, else bot" behavior. Any error (offline,
   * RLS not set up yet, etc.) also falls back to a bot match rather than
   * failing the join outright.
   */
  async joinQueue(params: JoinParams, waitMs = 1500) {
    this.myId = params.myId;
    try {
      const matched = await this.tryJoinPvpQueue(params, waitMs);
      if (matched) return;
    } catch (err) {
      console.error('PvP matchmaking failed, falling back to a bot match', err);
      if (this.queueRowId) {
        supabase.from('clash_pvp_queue').delete().eq('id', this.queueRowId).then(() => {});
        this.queueRowId = null;
      }
    }
    await this.joinBotMatch(params);
  }

  /** Returns true if a PvP match was started; false/throws otherwise (caller falls back to a bot match). */
  private async tryJoinPvpQueue(params: JoinParams, waitMs: number): Promise<boolean> {
    const { data: candidates, error: candidatesError } = await supabase
      .from('clash_pvp_queue').select('*').eq('status', 'waiting').limit(5);
    if (candidatesError) throw candidatesError;

    for (const row of candidates || []) {
      if (row.uid === this.myId) continue;
      const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      // Atomic claim: only succeeds if nobody else claimed this row first.
      const { data: claimed } = await supabase
        .from('clash_pvp_queue')
        .update({ status: 'matched', match_id: matchId })
        .eq('id', row.id).eq('status', 'waiting')
        .select().maybeSingle();
      if (!claimed) continue; // someone else claimed it first, try the next candidate

      this.isHost = true;
      this.myTeam = 'blue';
      this.opponentId = row.uid;
      const match = createMatch(matchId, true);
      match.players[row.uid] = {
        id: row.uid, team: 'red', name: row.name, mana: 5, isBot: false,
        deck: row.deck, trophies: row.trophies, cardLevels: row.card_levels, userId: row.uid,
      };
      match.players[params.myId] = {
        id: params.myId, team: 'blue', name: params.name, mana: 5, isBot: false,
        deck: params.deck, trophies: params.trophies, cardLevels: params.cardLevels, userId: params.myId,
      };
      this.match = match;
      await this.openMatchChannel(matchId);
      this.pushLocalState();
      this.startLocalLoops();
      return true;
    }

    // Nobody else was waiting: post myself and give someone else a brief window to claim me.
    const { data: inserted, error: insertError } = await supabase
      .from('clash_pvp_queue')
      .insert({ uid: params.myId, name: params.name, deck: params.deck, trophies: params.trophies, card_levels: params.cardLevels, status: 'waiting' })
      .select().single();
    if (insertError) throw insertError;
    this.queueRowId = inserted.id;

    const matchedId = await new Promise<string | null>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, waitMs);
      this.queueChannel = supabase
        .channel(`queue-${inserted.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clash_pvp_queue', filter: `id=eq.${inserted.id}` }, (payload: any) => {
          if (payload.new?.status === 'matched' && payload.new?.match_id && !settled) {
            settled = true;
            clearTimeout(timer);
            resolve(payload.new.match_id);
          }
        })
        .subscribe();
    });

    if (this.queueChannel) { supabase.removeChannel(this.queueChannel); this.queueChannel = null; }
    supabase.from('clash_pvp_queue').delete().eq('id', inserted.id).then(() => {});
    this.queueRowId = null;

    if (matchedId) {
      this.isHost = false;
      this.myTeam = 'red'; // the waiting player is always seated 'red' (see host branch above)
      await this.openMatchChannel(matchedId);
      return true;
    }
    return false;
  }

  /** Subscribes to the match's broadcast channel and starts presence tracking. */
  private async openMatchChannel(matchId: string) {
    const channel = supabase.channel(`match-${matchId}`, { config: { broadcast: { self: false }, presence: { key: this.myId } } });

    channel.on('broadcast', { event: 'state' }, ({ payload }: any) => {
      if (this.isHost) return; // host is authoritative; it doesn't apply its own echoed state
      this.lastRemoteSnapshot = payload;
      this.callbacks.onState(payload);
      if (payload.matchState?.status === 'GAMEOVER' && !this.ended) {
        this.ended = true;
        this.callbacks.onMatchResult(rewardForResult(payload.matchState.winner, this.myTeam));
      }
    });

    channel.on('broadcast', { event: 'action' }, ({ payload }: any) => {
      if (!this.isHost || !this.match) return;
      const p = this.match.players[payload.by];
      const card = CARDS[payload.cardId];
      if (p && card && p.mana >= card.cost) {
        p.mana -= card.cost;
        playCardLogic(this.match, p, card, payload.x, payload.y, this.events);
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key }: any) => {
      if (key !== this.myId && !this.ended) {
        this.ended = true;
        this.stopLoops();
        this.callbacks.onNotification('상대가 접속을 종료했습니다.', '#ef4444');
        const base = this.lastRemoteSnapshot ?? (this.match ? serialize(this.match) : null);
        if (base) {
          this.callbacks.onState({ ...base, matchState: { ...base.matchState, status: 'GAMEOVER', winner: this.myTeam } });
        }
        this.callbacks.onMatchResult(rewardForResult(this.myTeam, this.myTeam));
      }
    });

    await new Promise<void>((resolve) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ uid: this.myId });
          resolve();
        }
      });
    });
    this.matchChannel = channel;
  }

  /** The local player plays a card. Host applies it immediately; a guest relays it to the host. */
  playCard(cardId: string, x: number, y: number) {
    if (this.isHost) {
      if (!this.match) return;
      const p = this.match.players[this.myId];
      const card = CARDS[cardId];
      if (p && card && p.mana >= card.cost) {
        p.mana -= card.cost;
        playCardLogic(this.match, p, card, x, y, this.events);
        this.pushLocalState();
        if (this.matchChannel) this.syncToPeer();
      }
    } else if (this.matchChannel) {
      this.matchChannel.send({ type: 'broadcast', event: 'action', payload: { cardId, x, y, by: this.myId } });
    }
  }

  leave() {
    this.stopLoops();
    if (this.queueChannel) { supabase.removeChannel(this.queueChannel); this.queueChannel = null; }
    if (this.matchChannel) {
      // untrack()+unsubscribe() first so the opponent's presence 'leave' handler fires
      // promptly; removeChannel() alone can take a while for the server to notice.
      const ch = this.matchChannel;
      this.matchChannel = null;
      ch.untrack().finally(() => ch.unsubscribe().finally(() => supabase.removeChannel(ch)));
    }
    if (this.queueRowId) { supabase.from('clash_pvp_queue').delete().eq('id', this.queueRowId).then(() => {}); this.queueRowId = null; }
    this.match = null;
    this.lastRemoteSnapshot = null;
    this.ended = false;
    this.opponentId = null;
  }
}
