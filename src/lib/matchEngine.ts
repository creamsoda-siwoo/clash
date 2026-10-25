// Client-side port of the authoritative match simulation that used to run on the
// Socket.io server (server.ts). Running it in the browser means matches need no
// always-on backend process, so they work on serverless hosts like Vercel.
// Kept logic-for-logic identical to server.ts's tick/playCardLogic/spawnBot/createMatch.
import { CARDS, CardDef } from '../constants';

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 1600;
export const TICK_MS = 50; // throttled vs. the original 16ms/60fps server tick; still smooth, cheaper to run/sync client-side

export interface EngineUnit {
  id: string; ownerId: string; team: 'red' | 'blue'; cardId: string;
  x: number; y: number; hp: number; maxHp: number; cooldown: number;
  freezeTime: number; rageTime: number; poisonTime: number; level: number;
}
export interface EngineBody {
  id?: string; team: 'red' | 'blue'; x: number; y: number; hp: number; maxHp: number;
  radius: number; cooldown: number; freezeTime: number; poisonTime: number;
}
export interface EnginePlayer {
  id: string; team: 'red' | 'blue'; name: string; mana: number; isBot: boolean;
  deck: string[]; trophies: number; cardLevels: Record<string, number>;
  lastCardTime?: number; userId?: string;
}
export interface EngineMatchState {
  status: 'PLAYING' | 'GAMEOVER'; winner: string; timeLeft: number;
  isDoubleMana: boolean; isOvertime: boolean;
  theme: 'DEFAULT' | 'LAVA' | 'ICE' | 'FOREST'; isPvP: boolean; lastPulse?: number;
}
export interface EngineMatch {
  id: string;
  players: Record<string, EnginePlayer>;
  units: EngineUnit[];
  projectiles: any[];
  effects: any[];
  bases: { red: EngineBody; blue: EngineBody };
  towers: EngineBody[];
  matchState: EngineMatchState;
}

export interface EngineEvents {
  damageText: (x: number, y: number, amount: number, color: string) => void;
  notification: (message: string, color: string) => void;
}

export function createMatch(id: string, isPvP: boolean): EngineMatch {
  const themes: EngineMatchState['theme'][] = ['DEFAULT', 'LAVA', 'ICE', 'FOREST'];
  return {
    id,
    players: {},
    units: [],
    projectiles: [],
    effects: [],
    bases: {
      red: { team: 'red', x: 450, y: 150, hp: 3000, maxHp: 3000, radius: 80, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      blue: { team: 'blue', x: 450, y: 1450, hp: 3000, maxHp: 3000, radius: 80, cooldown: 0, freezeTime: 0, poisonTime: 0 },
    },
    towers: [
      { id: 'r_left', team: 'red', x: 250, y: 450, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'r_right', team: 'red', x: 650, y: 450, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'b_left', team: 'blue', x: 250, y: 1150, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'b_right', team: 'blue', x: 650, y: 1150, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
    ],
    matchState: {
      status: 'PLAYING', winner: '', timeLeft: 180,
      isDoubleMana: false, isOvertime: false,
      theme: themes[Math.floor(Math.random() * themes.length)], isPvP,
    },
  };
}

let botCounter = 1;
export function spawnBot(match: EngineMatch, team: 'red' | 'blue', playerTrophies: number, playerCardLevels: Record<string, number> = {}): string {
  const id = 'bot_' + botCounter++;
  const allCardIds = Object.keys(CARDS);
  const units = allCardIds.filter(cid => CARDS[cid].type === 'unit');
  const spells = allCardIds.filter(cid => CARDS[cid].type === 'spell');
  const botDeck = [...units.sort(() => 0.5 - Math.random()).slice(0, 4), ...spells.sort(() => 0.5 - Math.random()).slice(0, 2)];
  const levels = Object.values(playerCardLevels);
  const avgLevel = levels.length > 0 ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 1;
  const botLevel = Math.max(1, avgLevel + (playerTrophies < 500 ? -1 : playerTrophies > 2000 ? 1 : 0));
  const botCardLevels: Record<string, number> = {};
  botDeck.forEach(cid => botCardLevels[cid] = botLevel);

  match.players[id] = {
    id, team, name: 'AI 사령관', mana: 5, isBot: true, deck: botDeck,
    trophies: Math.max(0, playerTrophies + Math.floor(Math.random() * 41) - 20),
    cardLevels: botCardLevels,
  };
  return id;
}

export function playCardLogic(match: EngineMatch, p: EnginePlayer, card: CardDef, x: number, y: number, events: EngineEvents) {
  const level = p.cardLevels[card.id] || 1;
  const mult = 1 + (level - 1) * 0.1;

  if (card.type === 'unit') {
    const count = card.count || 1;
    for (let i = 0; i < count; i++) {
      match.units.push({
        id: Math.random().toString(36).substr(2, 9), ownerId: p.id, team: p.team, cardId: card.id,
        x: x + (count > 1 ? (Math.random() * 40 - 20) : 0),
        y: y + (count > 1 ? (Math.random() * 40 - 20) : 0),
        hp: card.hp! * mult, maxHp: card.hp! * mult, cooldown: 0, freezeTime: 0, rageTime: 0, poisonTime: 0, level,
      });
    }
  } else if (card.type === 'spell') {
    match.effects.push({ id: Math.random().toString(36).substr(2, 9), x, y, radius: 10, maxRadius: card.radius!, color: card.color });
    const damage = card.dmg * mult;
    const enemyBase = p.team === 'red' ? match.bases.blue : match.bases.red;

    if (card.id === 'freeze') {
      match.units.forEach(u => { if (u.team !== p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) u.freezeTime = card.duration!; });
      match.towers.forEach(t => { if (t.team !== p.team && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) t.freezeTime = card.duration!; });
      if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) enemyBase.freezeTime = card.duration!;
    } else if (card.id === 'rage') {
      (match.units as any[]).forEach(u => { if (u.team === p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) u.rageTime = card.duration!; });
    } else if (card.id === 'poison') {
      match.units.forEach(u => { if (u.team !== p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) u.poisonTime = card.duration!; });
      match.towers.forEach(t => { if (t.team !== p.team && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) t.poisonTime = card.duration!; });
      if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) enemyBase.poisonTime = card.duration!;
    } else if (card.id === 'lightning') {
      let targets: any[] = [];
      match.units.forEach(u => { if (u.team !== p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) targets.push({ obj: u }); });
      match.towers.forEach(t => { if (t.team !== p.team && t.hp > 0 && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) targets.push({ obj: t }); });
      if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) targets.push({ obj: enemyBase });
      targets.sort((a, b) => b.obj.hp - a.obj.hp).slice(0, card.targetCount!).forEach(t => {
        t.obj.hp -= damage;
        events.damageText(t.obj.x, t.obj.y, Math.floor(damage), '#ef4444');
      });
    } else if (card.id === 'graveyard') {
      for (let i = 0; i < (card.count || 10); i++) {
        const angle = Math.random() * Math.PI * 2, dist = Math.random() * card.radius!;
        match.units.push({
          id: Math.random().toString(36).substr(2, 9), ownerId: p.id, team: p.team, cardId: 'skeletons',
          x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
          hp: CARDS['skeletons'].hp! * mult, maxHp: CARDS['skeletons'].hp! * mult, cooldown: 0, freezeTime: 0, rageTime: 0, poisonTime: 0, level,
        });
      }
    } else {
      const isHeal = damage < 0, amount = Math.abs(damage);
      match.units.forEach(u => {
        if ((isHeal ? u.team === p.team : u.team !== p.team) && Math.hypot(u.x - x, u.y - y) <= card.radius!) {
          u.hp = isHeal ? Math.min(u.maxHp, u.hp + amount) : u.hp - amount;
          events.damageText(u.x, u.y, Math.floor(amount), isHeal ? '#22c55e' : '#ef4444');
        }
      });
      if (!isHeal) {
        match.towers.forEach(t => {
          if (t.team !== p.team && t.hp > 0 && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) {
            t.hp -= amount;
            events.damageText(t.x, t.y, Math.floor(amount), '#ef4444');
          }
        });
        if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) {
          enemyBase.hp -= amount;
          events.damageText(enemyBase.x, enemyBase.y, Math.floor(amount), '#ef4444');
        }
      }
    }
  }
}

function endMatch(match: EngineMatch, winner: string) {
  if (match.matchState.status === 'GAMEOVER') return;
  match.matchState.status = 'GAMEOVER';
  match.matchState.winner = winner;
}

// Advances the match by one tick (TICK_MS of game time). Call on a fixed interval.
export function tickMatch(match: EngineMatch, events: EngineEvents) {
  if (match.matchState.status !== 'PLAYING') return;

  match.matchState.timeLeft -= TICK_MS / 1000;
  if (match.matchState.timeLeft <= 0) {
    if (!match.matchState.isOvertime) {
      match.matchState.isOvertime = true;
      match.matchState.isDoubleMana = true;
      match.matchState.timeLeft = 60;
      events.notification('연장전 시작!', '#ef4444');
    } else {
      endMatch(match, 'draw');
      return;
    }
  }

  Object.values(match.players).forEach(p => {
    let rate = (match.matchState.isDoubleMana ? 2 : 1) / (2000 / TICK_MS);
    if (p.isBot) rate *= Math.min(1.5, 0.8 + (p.trophies / 4000));
    p.mana = Math.min(10, p.mana + rate);
  });

  if (!match.matchState.lastPulse) match.matchState.lastPulse = Date.now();
  if (Date.now() - match.matchState.lastPulse! > 5000 + Math.random() * 5000) {
    const bonus = 1 + Math.floor(Math.random() * 3);
    Object.values(match.players).forEach(p => { p.mana = Math.min(10, p.mana + bonus); });
    match.matchState.lastPulse = Date.now();
    events.notification(`🌀 마나 폭풍! +${bonus} 마나`, '#3b82f6');
  }

  for (let i = match.units.length - 1; i >= 0; i--) {
    const u = match.units[i];
    if (u.hp <= 0) { match.units.splice(i, 1); continue; }
    if (u.freezeTime > 0) { u.freezeTime -= TICK_MS; continue; }
    if (u.poisonTime > 0) { u.poisonTime -= TICK_MS; u.hp -= 0.5; }
    if (u.cooldown > 0) u.cooldown -= TICK_MS;

    let target: any = null, minDist = Infinity;
    match.units.forEach(e => { if (e.team !== u.team) { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < minDist) { minDist = d; target = e; } } });
    match.towers.forEach(t => { if (t.team !== u.team && t.hp > 0) { const d = Math.hypot(t.x - u.x, t.y - u.y); if (d < minDist) { minDist = d; target = t; } } });
    const enemyBase = u.team === 'red' ? match.bases.blue : match.bases.red;
    const dBase = Math.hypot(enemyBase.x - u.x, enemyBase.y - u.y);
    if (dBase < minDist) { target = enemyBase; minDist = dBase; }

    const stats = CARDS[u.cardId];
    if (target) {
      if (minDist <= stats.range!) {
        if (u.cooldown <= 0) {
          u.cooldown = stats.atkSpeed!;
          const dmg = stats.dmg * (1 + (u.level - 1) * 0.1);

          if (u.cardId === 'healer') {
            match.units.forEach(allied => {
              if (allied.team === u.team && Math.hypot(allied.x - u.x, allied.y - u.y) <= 150) {
                allied.hp = Math.min(allied.maxHp, allied.hp + dmg);
                events.damageText(allied.x, allied.y, Math.floor(dmg), '#22c55e');
              }
            });
          } else if (stats.isAoE) {
            const splashRadius = 100;
            match.units.forEach(e => {
              if (e.team !== u.team && Math.hypot(e.x - target.x, e.y - target.y) <= splashRadius) {
                e.hp -= dmg;
                events.damageText(e.x, e.y, Math.floor(dmg), '#ef4444');
              }
            });
            match.towers.forEach(t => {
              if (t.team !== u.team && Math.hypot(t.x - target.x, t.y - target.y) <= splashRadius + t.radius) {
                t.hp -= dmg;
                events.damageText(t.x, t.y, Math.floor(dmg), '#ef4444');
              }
            });
          } else {
            target.hp -= dmg;
            events.damageText(target.x, target.y, Math.floor(dmg), '#ef4444');
          }

          if (target.hp <= 0) {
            if (target.team && (target.y <= 200 || target.y >= 1400)) {
              endMatch(match, u.team);
            } else {
              const towerIdx = match.towers.findIndex(t => t.id === target.id);
              if (towerIdx !== -1) match.towers.splice(towerIdx, 1);
            }
          }
        }
      } else {
        const angle = Math.atan2(target.y - u.y, target.x - u.x);
        const speed = stats.speed || 0;
        u.x += Math.cos(angle) * speed;
        u.y += Math.sin(angle) * speed;
      }
    }
  }
}

// Call less frequently than tickMatch (e.g. every ~500ms) to let bot players play cards.
export function botThink(match: EngineMatch, events: EngineEvents) {
  if (match.matchState.status !== 'PLAYING') return;
  Object.values(match.players).forEach(p => {
    if (!p.isBot || p.mana < (match.matchState.isOvertime ? 3 : 5)) return;
    if (p.lastCardTime && Date.now() - p.lastCardTime < 4000) return;
    if (Math.random() < 0.05) {
      const cid = p.deck[Math.floor(Math.random() * p.deck.length)];
      const card = CARDS[cid];
      p.mana -= card.cost; p.lastCardTime = Date.now();
      const x = 200 + Math.random() * 500;
      const y = p.team === 'red' ? 200 + Math.random() * 200 : MAP_HEIGHT - 400 + Math.random() * 200;
      playCardLogic(match, p, card, x, y, events);
    }
  });
}

export function rewardForResult(winner: string, myTeam: string): { result: 'win' | 'lose' | 'draw'; trophyChange: number; goldChange: number } {
  const isWin = winner === myTeam;
  return {
    result: isWin ? 'win' : winner === 'draw' ? 'draw' : 'lose',
    trophyChange: isWin ? 30 : -20,
    goldChange: isWin ? 50 : 10,
  };
}
