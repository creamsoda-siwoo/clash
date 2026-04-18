import express from "express";
import next from "next";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { CARDS, CardDef } from "./src/constants.ts";

const PORT = 3000;
const MAP_WIDTH = 900;
const MAP_HEIGHT = 1600;
const TICK_RATE = 16; // 60fps

process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); });

// --- Types ---
interface Player {
  id: string;
  team: 'red' | 'blue';
  name: string;
  mana: number;
  isBot: boolean;
  deck: string[];
  trophies: number;
  cardLevels: Record<string, number>;
  lastCardTime?: number;
  userId?: string;
}

interface MatchState {
  status: 'LOBBY' | 'PLAYING' | 'GAMEOVER';
  winner: string;
  timeLeft: number;
  isDoubleMana: boolean;
  isOvertime: boolean;
  theme: 'DEFAULT' | 'LAVA' | 'ICE' | 'FOREST';
  isPvP?: boolean;
  lastPulse?: number;
}

interface Match {
  id: string;
  players: Record<string, Player>;
  units: any[];
  projectiles: any[];
  effects: any[];
  bases: Record<'red' | 'blue', any>;
  towers: any[];
  matchState: MatchState;
}

// --- Global State ---
const matches = new Map<string, Match>();
const playerToMatch = new Map<string, string>();
const allUsers = new Map<string, { id: string, name: string, trophies: number, status: 'LOBBY' | 'PLAYING' }>();
let matchmakingQueue: any[] = [];

// --- Helper Functions ---
function createMatch(id: string, isPvP: boolean = false): Match {
  const themes: MatchState['theme'][] = ['DEFAULT', 'LAVA', 'ICE', 'FOREST'];
  return {
    id,
    players: {},
    units: [],
    projectiles: [],
    effects: [],
    bases: {
      red: { team: 'red', x: 450, y: 150, hp: 3000, maxHp: 3000, radius: 80, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      blue: { team: 'blue', x: 450, y: 1450, hp: 3000, maxHp: 3000, radius: 80, cooldown: 0, freezeTime: 0, poisonTime: 0 }
    },
    towers: [
      { id: 'r_left', team: 'red', x: 250, y: 450, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'r_right', team: 'red', x: 650, y: 450, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'b_left', team: 'blue', x: 250, y: 1150, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'b_right', team: 'blue', x: 650, y: 1150, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
    ],
    matchState: {
      status: 'PLAYING',
      winner: '',
      timeLeft: 180,
      isDoubleMana: false,
      isOvertime: false,
      theme: themes[Math.floor(Math.random() * themes.length)],
      isPvP
    }
  };
}

let botCounter = 1;
function spawnBot(match: Match, team: 'red' | 'blue', playerTrophies: number, playerCardLevels: Record<string, number> = {}) {
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
    id, team, name: `AI 사령관`, mana: 5, isBot: true, deck: botDeck,
    trophies: Math.max(0, playerTrophies + Math.floor(Math.random() * 41) - 20),
    cardLevels: botCardLevels
  };
}

function playCardLogic(match: Match, p: Player, card: CardDef, x: number, y: number, io: Server) {
  const level = p.cardLevels[card.id] || 1;
  const mult = 1 + (level - 1) * 0.1;

  if (card.type === 'unit') {
    const count = card.count || 1;
    for (let i = 0; i < count; i++) {
      match.units.push({
        id: Math.random().toString(36).substr(2, 9), ownerId: p.id, team: p.team, cardId: card.id,
        x: x + (count > 1 ? (Math.random() * 40 - 20) : 0),
        y: y + (count > 1 ? (Math.random() * 40 - 20) : 0),
        hp: card.hp! * mult, maxHp: card.hp! * mult, cooldown: 0, freezeTime: 0, rageTime: 0, poisonTime: 0, level
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
      match.units.forEach(u => { if (u.team === p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) u.rageTime = card.duration!; });
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
        io.to(match.id).emit('damageText', { x: t.obj.x, y: t.obj.y, amount: Math.floor(damage), color: '#ef4444' });
      });
    } else if (card.id === 'graveyard') {
      for (let i = 0; i < (card.count || 10); i++) {
        const angle = Math.random() * Math.PI * 2, dist = Math.random() * card.radius!;
        match.units.push({
          id: Math.random().toString(36).substr(2, 9), ownerId: p.id, team: p.team, cardId: 'skeletons',
          x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
          hp: CARDS['skeletons'].hp! * mult, maxHp: CARDS['skeletons'].hp! * mult, cooldown: 0, freezeTime: 0, rageTime: 0, poisonTime: 0, level
        });
      }
    } else {
      const isHeal = damage < 0, amount = Math.abs(damage);
      match.units.forEach(u => {
        if ((isHeal ? u.team === p.team : u.team !== p.team) && Math.hypot(u.x - x, u.y - y) <= card.radius!) {
          u.hp = isHeal ? Math.min(u.maxHp, u.hp + amount) : u.hp - amount;
          io.to(match.id).emit('damageText', { x: u.x, y: u.y, amount: Math.floor(amount), color: isHeal ? '#22c55e' : '#ef4444' });
        }
      });
      if (!isHeal) {
        match.towers.forEach(t => {
          if (t.team !== p.team && t.hp > 0 && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) {
            t.hp -= amount;
            io.to(match.id).emit('damageText', { x: t.x, y: t.y, amount: Math.floor(amount), color: '#ef4444' });
          }
        });
        if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) {
          enemyBase.hp -= amount;
          io.to(match.id).emit('damageText', { x: enemyBase.x, y: enemyBase.y, amount: Math.floor(amount), color: '#ef4444' });
        }
      }
    }
  }
}

async function startServer() {
  const nextApp = next({ dev: process.env.NODE_ENV !== "production" });
  await nextApp.prepare();
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  // Update loop for all matches
  setInterval(() => {
    matches.forEach((match, matchId) => {
      if (match.matchState.status !== 'PLAYING') return;

      // Match state time
      match.matchState.timeLeft -= TICK_RATE / 1000;
      if (match.matchState.timeLeft <= 0) {
        if (!match.matchState.isOvertime) {
          match.matchState.isOvertime = true;
          match.matchState.isDoubleMana = true;
          match.matchState.timeLeft = 60;
          io.to(matchId).emit('notification', { message: '연장전 시작!', color: '#ef4444' });
        } else {
          endMatch(match, 'draw');
        }
      }

      // Elixir regen
      Object.values(match.players).forEach(p => {
        let rate = (match.matchState.isDoubleMana ? 2 : 1) / (2000 / TICK_RATE);
        if (p.isBot) rate *= Math.min(1.5, 0.8 + (p.trophies / 4000));
        p.mana = Math.min(10, p.mana + rate);
      });

      // Random Mana Pulse (Every ~7s)
      if (!match.matchState.lastPulse) (match.matchState as any).lastPulse = Date.now();
      if (Date.now() - (match.matchState as any).lastPulse > 5000 + Math.random() * 5000) {
        const bonus = 1 + Math.floor(Math.random() * 3);
        Object.values(match.players).forEach(p => {
            p.mana = Math.min(10, p.mana + bonus);
        });
        (match.matchState as any).lastPulse = Date.now();
        io.to(matchId).emit('notification', { message: `🌀 마나 폭풍! +${bonus} 마나`, color: '#3b82f6' });
      }

      // Update Units
      for (let i = match.units.length - 1; i >= 0; i--) {
        const u = match.units[i];
        if (u.hp <= 0) { match.units.splice(i, 1); continue; }
        if (u.freezeTime > 0) { u.freezeTime -= TICK_RATE; continue; }
        if (u.poisonTime > 0) { u.poisonTime -= TICK_RATE; u.hp -= 0.5; }
        if (u.cooldown > 0) u.cooldown -= TICK_RATE;

        // Simple Target Logic
        let target = null, minDist = Infinity;
        match.units.forEach(e => { if(e.team !== u.team) { const d = Math.hypot(e.x-u.x, e.y-u.y); if(d<minDist){ minDist=d; target=e; } } });
        match.towers.forEach(t => { if(t.team !== u.team && t.hp > 0) { const d = Math.hypot(t.x-u.x, t.y-u.y); if(d<minDist){ minDist=d; target=t; } } });
        const enemyBase = u.team === 'red' ? match.bases.blue : match.bases.red;
        const dBase = Math.hypot(enemyBase.x-u.x, enemyBase.y-u.y);
        if(dBase < minDist) { target = enemyBase; minDist = dBase; }

        const stats = CARDS[u.cardId];
        if (target) {
          if (minDist <= stats.range!) {
            if (u.cooldown <= 0) {
              u.cooldown = stats.atkSpeed!;
              const dmg = stats.dmg * (1 + (u.level - 1) * 0.1);
              
              if (u.cardId === 'healer') {
                // Heal allies in range
                match.units.forEach(allied => {
                  if (allied.team === u.team && Math.hypot(allied.x - u.x, allied.y - u.y) <= 150) {
                    allied.hp = Math.min(allied.maxHp, allied.hp + dmg);
                    io.to(matchId).emit('damageText', { x: allied.x, y: allied.y, amount: Math.floor(dmg), color: '#22c55e' });
                  }
                });
              } else if (stats.isAoE) {
                // Splash damage
                const splashRadius = 100;
                match.units.forEach(e => {
                  if (e.team !== u.team && Math.hypot(e.x - target.x, e.y - target.y) <= splashRadius) {
                    e.hp -= dmg;
                    io.to(matchId).emit('damageText', { x: e.x, y: e.y, amount: Math.floor(dmg), color: '#ef4444' });
                  }
                });
                match.towers.forEach(t => {
                   if (t.team !== u.team && Math.hypot(t.x - target.x, t.y - target.y) <= splashRadius + t.radius) {
                     t.hp -= dmg;
                     io.to(matchId).emit('damageText', { x: t.x, y: t.y, amount: Math.floor(dmg), color: '#ef4444' });
                   }
                });
              } else {
                // Single target damage
                target.hp -= dmg;
                io.to(matchId).emit('damageText', { x: target.x, y: target.y, amount: Math.floor(dmg), color: '#ef4444' });
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

      // Sync
      io.to(matchId).emit('gameState', { players: match.players, units: match.units, projectiles: match.projectiles, effects: match.effects, bases: Object.values(match.bases), towers: match.towers, matchState: match.matchState });
    });
  }, TICK_RATE);

  function endMatch(match: Match, winner: string) {
    if (match.matchState.status === 'GAMEOVER') return;
    match.matchState.status = 'GAMEOVER';
    match.matchState.winner = winner;
    Object.values(match.players).forEach(p => {
      if (!p.isBot) {
        const isWin = winner === p.team;
        io.to(p.id).emit('matchResult', { result: isWin ? 'win' : winner === 'draw' ? 'draw' : 'lose', trophyChange: isWin ? 30 : -20, goldChange: isWin ? 50 : 10 });
      }
    });
  }

  // AI Think Loop
  setInterval(() => {
    matches.forEach(match => {
      if (match.matchState.status !== 'PLAYING') return;
      Object.values(match.players).forEach(p => {
        if (!p.isBot || p.mana < (match.matchState.isOvertime ? 3 : 5)) return;
        if (p.lastCardTime && Date.now() - p.lastCardTime < 4000) return;
        if (Math.random() < 0.05) {
          const cid = p.deck[Math.floor(Math.random() * p.deck.length)];
          const card = CARDS[cid];
          p.mana -= card.cost; p.lastCardTime = Date.now();
          const x = 200 + Math.random() * 500;
          const y = p.team === 'red' ? 200 + Math.random()*200 : MAP_HEIGHT-400 + Math.random()*200;
          playCardLogic(match, p, card, x, y, io);
        }
      });
    });
  }, 500);

  io.on("connection", (socket) => {
    allUsers.set(socket.id, { id: socket.id, name: '사령관', trophies: 0, status: 'LOBBY' });

    socket.on("joinQueue", (data) => {
      if (playerToMatch.has(socket.id)) return;
      
      const opponent = matchmakingQueue.shift();
      if (opponent && opponent.id !== socket.id) {
        const matchId = `match_${Date.now()}_pvp`;
        const match = createMatch(matchId, true);
        match.players[opponent.id] = { ...opponent, team: 'red', mana: 5, isBot: false };
        match.players[socket.id] = { id: socket.id, team: 'blue', name: data.name, deck: data.deck, trophies: data.trophies, cardLevels: data.cardLevels, mana: 5, isBot: false, userId: data.userId };
        playerToMatch.set(opponent.id, matchId);
        playerToMatch.set(socket.id, matchId);
        socket.join(matchId);
        io.sockets.sockets.get(opponent.id)?.join(matchId);
        matches.set(matchId, match);
      } else {
        const queueEntry = { id: socket.id, name: data.name, deck: data.deck, trophies: data.trophies, cardLevels: data.cardLevels };
        matchmakingQueue.push(queueEntry);
        setTimeout(() => {
          const index = matchmakingQueue.findIndex(q => q.id === socket.id);
          if (index !== -1) {
            matchmakingQueue.splice(index, 1);
            const matchId = `match_${Date.now()}_ai`;
            const match = createMatch(matchId, false);
            match.players[socket.id] = { id: socket.id, team: 'blue', name: data.name, deck: data.deck, trophies: data.trophies, cardLevels: data.cardLevels, mana: 5, isBot: false, userId: data.userId };
            spawnBot(match, 'red', data.trophies, data.cardLevels);
            playerToMatch.set(socket.id, matchId);
            socket.join(matchId);
            matches.set(matchId, match);
          }
        }, 0);
      }
    });

    socket.on("playCard", (data) => {
      const mid = playerToMatch.get(socket.id);
      const m = mid ? matches.get(mid) : null;
      if (m && m.players[socket.id]) {
        const p = m.players[socket.id];
        const card = CARDS[data.cardId];
        if (p.mana >= card.cost) {
          p.mana -= card.cost;
          playCardLogic(m, p, card, data.x, data.y, io);
        }
      }
    });

    socket.on("leaveGame", () => {
      const mid = playerToMatch.get(socket.id);
      if (mid) matches.delete(mid);
      playerToMatch.delete(socket.id);
    });

    socket.on("disconnect", () => {
      const mid = playerToMatch.get(socket.id);
      if (mid) matches.delete(mid);
      allUsers.delete(socket.id);
      playerToMatch.delete(socket.id);
      matchmakingQueue = matchmakingQueue.filter(q => q.id !== socket.id);
    });
  });

  app.all("*", (req, res) => nextApp.getRequestHandler()(req, res));
  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}

startServer();
