// Runs matches entirely in the browser instead of on a Socket.io server.
// Bot matches never touch the network. PvP matches elect one of the two
// players' browsers as the "host" (it runs the authoritative simulation) and
// relay state/actions through Firestore (already used for auth/user data),
// which is itself a managed always-on service — no server process to run.
import { db } from './firebase';
import {
  collection, doc, addDoc, deleteDoc, onSnapshot, query, where,
  getDocs, limit, runTransaction, setDoc, updateDoc,
} from 'firebase/firestore';
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
  private matchDocId: string | null = null;
  private queueDocId: string | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private aiTimer: ReturnType<typeof setInterval> | null = null;
  private unsubs: (() => void)[] = [];
  private callbacks: MatchCallbacks;
  private ended = false;
  private lastSyncAt = 0;
  private lastRemoteSnapshot: MatchSnapshot | null = null;

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
      if (this.matchDocId) this.syncToFirestore();
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

  private syncToFirestore() {
    if (!this.match || !this.matchDocId) return;
    const now = Date.now();
    const isFinal = this.match.matchState.status === 'GAMEOVER';
    if (!isFinal && now - this.lastSyncAt < 90) return; // throttle writes to ~11/s
    this.lastSyncAt = now;
    updateDoc(doc(db, 'matches', this.matchDocId), { state: serialize(this.match), updatedAt: now }).catch(() => {});
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
   * Tries to pair with another player waiting in the Firestore queue for `waitMs`.
   * Falls back to a bot match if nobody is found in time, mirroring the old
   * server's "instant PvP, else bot" behavior. Any Firestore error (offline,
   * rules not deployed yet, etc.) also falls back to a bot match rather than
   * failing the join outright.
   */
  async joinQueue(params: JoinParams, waitMs = 1500) {
    this.myId = params.myId;
    try {
      const matched = await this.tryJoinPvpQueue(params, waitMs);
      if (matched) return;
    } catch (err) {
      console.error('PvP matchmaking failed, falling back to a bot match', err);
      if (this.queueDocId) {
        deleteDoc(doc(db, 'pvpQueue', this.queueDocId)).catch(() => {});
        this.queueDocId = null;
      }
    }
    await this.joinBotMatch(params);
  }

  /** Returns true if a PvP match was started; false/throws otherwise (caller falls back to a bot match). */
  private async tryJoinPvpQueue(params: JoinParams, waitMs: number): Promise<boolean> {
    const queueCol = collection(db, 'pvpQueue');

    const candidates = await getDocs(query(queueCol, where('status', '==', 'waiting'), limit(5)));
    for (const d of candidates.docs) {
      const data = d.data();
      if (data.uid === this.myId) continue;
      let matchId: string | null = null;
      try {
        matchId = await runTransaction(db, async (tx) => {
          const fresh = await tx.get(d.ref);
          if (!fresh.exists() || fresh.data()?.status !== 'waiting') throw new Error('taken');
          const mId = 'match_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          tx.update(d.ref, { status: 'matched', matchId: mId });
          return mId;
        });
      } catch {
        continue; // someone else claimed this entry first, try the next candidate
      }
      if (!matchId) continue;

      this.isHost = true;
      this.myTeam = 'blue';
      this.matchDocId = matchId;
      const match = createMatch(matchId, true);
      match.players[data.uid] = {
        id: data.uid, team: 'red', name: data.name, mana: 5, isBot: false,
        deck: data.deck, trophies: data.trophies, cardLevels: data.cardLevels, userId: data.uid,
      };
      match.players[params.myId] = {
        id: params.myId, team: 'blue', name: params.name, mana: 5, isBot: false,
        deck: params.deck, trophies: params.trophies, cardLevels: params.cardLevels, userId: params.myId,
      };
      this.match = match;
      await setDoc(doc(db, 'matches', matchId), { state: serialize(match), updatedAt: Date.now(), hostId: params.myId, guestId: data.uid });
      this.pushLocalState();
      this.startLocalLoops();
      this.listenForActions();
      return true;
    }

    // Nobody else was waiting: post myself and give someone else a brief window to claim me.
    const myQueueRef = doc(collection(db, 'pvpQueue'));
    this.queueDocId = myQueueRef.id;
    await setDoc(myQueueRef, {
      uid: params.myId, name: params.name, deck: params.deck, trophies: params.trophies,
      cardLevels: params.cardLevels, status: 'waiting', createdAt: Date.now(),
    });

    const matchedId = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => { unsub(); resolve(null); }, waitMs);
      const unsub = onSnapshot(myQueueRef, (s) => {
        const data = s.data();
        if (data?.status === 'matched' && data.matchId) {
          clearTimeout(timer);
          unsub();
          resolve(data.matchId);
        }
      });
    });

    deleteDoc(myQueueRef).catch(() => {});
    this.queueDocId = null;

    if (matchedId) {
      this.isHost = false;
      this.myTeam = 'red'; // the waiting player is always seated 'red' (see host branch above)
      this.matchDocId = matchedId;
      this.listenToMatchDoc(matchedId);
      return true;
    }
    return false;
  }

  private listenToMatchDoc(matchId: string) {
    const unsub = onSnapshot(doc(db, 'matches', matchId), (s) => {
      if (!s.exists()) {
        if (!this.ended && this.lastRemoteSnapshot) {
          this.ended = true;
          this.callbacks.onNotification('상대가 접속을 종료했습니다.', '#ef4444');
          this.callbacks.onState({
            ...this.lastRemoteSnapshot,
            matchState: { ...this.lastRemoteSnapshot.matchState, status: 'GAMEOVER', winner: this.myTeam },
          });
          this.callbacks.onMatchResult(rewardForResult(this.myTeam, this.myTeam));
        }
        return;
      }
      const data = s.data();
      if (!data?.state) return;
      this.lastRemoteSnapshot = data.state;
      this.callbacks.onState(data.state);
      if (data.state.matchState?.status === 'GAMEOVER' && !this.ended) {
        this.ended = true;
        this.callbacks.onMatchResult(rewardForResult(data.state.matchState.winner, this.myTeam));
      }
    });
    this.unsubs.push(unsub);
  }

  private listenForActions() {
    if (!this.matchDocId) return;
    const q = query(collection(db, 'matches', this.matchDocId, 'actions'), where('consumed', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added' || !this.match) return;
        const data = change.doc.data();
        const p = this.match.players[data.by];
        const card = CARDS[data.cardId];
        if (p && card && p.mana >= card.cost) {
          p.mana -= card.cost;
          playCardLogic(this.match, p, card, data.x, data.y, this.events);
        }
        updateDoc(change.doc.ref, { consumed: true }).catch(() => {});
      });
    });
    this.unsubs.push(unsub);
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
        if (this.matchDocId) this.syncToFirestore();
      }
    } else if (this.matchDocId) {
      addDoc(collection(db, 'matches', this.matchDocId, 'actions'), {
        cardId, x, y, by: this.myId, consumed: false, createdAt: Date.now(),
      }).catch(() => {});
    }
  }

  leave() {
    this.stopLoops();
    this.unsubs.forEach(u => u());
    this.unsubs = [];
    if (this.queueDocId) deleteDoc(doc(db, 'pvpQueue', this.queueDocId)).catch(() => {});
    if (this.isHost && this.matchDocId) deleteDoc(doc(db, 'matches', this.matchDocId)).catch(() => {});
    this.match = null;
    this.matchDocId = null;
    this.queueDocId = null;
    this.lastRemoteSnapshot = null;
    this.ended = false;
  }
}
