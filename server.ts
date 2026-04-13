import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

const PORT = 3000;

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 900;
const TICK_RATE = 16; // 60fps

interface CardDef {
  id: string;
  name: string;
  type: 'unit' | 'spell';
  cost: number;
  hp?: number;
  dmg: number;
  speed?: number;
  range?: number;
  atkSpeed?: number;
  radius?: number;
  color: string;
  count?: number; // For swarm units
  isAoE?: boolean; // For splash damage units
  duration?: number; // For status spells
  targetCount?: number; // For lightning
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const CARDS: Record<string, CardDef> = {
  knight: { id: 'knight', name: '기사', type: 'unit', cost: 3, hp: 800, dmg: 60, speed: 3, range: 50, atkSpeed: 1000, color: '#94a3b8', rarity: 'common' },
  archer: { id: 'archer', name: '궁수', type: 'unit', cost: 3, hp: 250, dmg: 40, speed: 3, range: 400, atkSpeed: 1000, color: '#4ade80', rarity: 'common' },
  giant: { id: 'giant', name: '거인', type: 'unit', cost: 5, hp: 2000, dmg: 100, speed: 1.5, range: 60, atkSpeed: 1500, color: '#facc15', rarity: 'rare' },
  assassin: { id: 'assassin', name: '암살자', type: 'unit', cost: 2, hp: 300, dmg: 80, speed: 5, range: 40, atkSpeed: 600, color: '#a855f7', rarity: 'epic' },
  valkyrie: { id: 'valkyrie', name: '발키리', type: 'unit', cost: 4, hp: 1000, dmg: 50, speed: 3, range: 70, atkSpeed: 1200, color: '#f43f5e', isAoE: true, rarity: 'rare' },
  sniper: { id: 'sniper', name: '저격수', type: 'unit', cost: 4, hp: 200, dmg: 120, speed: 2, range: 600, atkSpeed: 2000, color: '#06b6d4', rarity: 'epic' },
  skeletons: { id: 'skeletons', name: '해골 무리', type: 'unit', cost: 3, hp: 100, dmg: 25, speed: 4, range: 40, atkSpeed: 800, color: '#e2e8f0', count: 4, rarity: 'common' },
  fireball: { id: 'fireball', name: '파이어볼', type: 'spell', cost: 4, dmg: 300, radius: 150, color: '#ef4444', rarity: 'rare' },
  heal: { id: 'heal', name: '치유', type: 'spell', cost: 3, dmg: -300, radius: 150, color: '#22c55e', rarity: 'rare' },
  freeze: { id: 'freeze', name: '빙결', type: 'spell', cost: 3, dmg: 0, radius: 150, color: '#38bdf8', duration: 4000, rarity: 'epic' },
  rage: { id: 'rage', name: '분노', type: 'spell', cost: 2, dmg: 0, radius: 150, color: '#d946ef', duration: 5000, rarity: 'epic' },
  lightning: { id: 'lightning', name: '번개', type: 'spell', cost: 5, dmg: 400, radius: 200, color: '#fde047', targetCount: 3, rarity: 'epic' },
  dragon: { id: 'dragon', name: '드래곤', type: 'unit', cost: 4, hp: 1200, dmg: 80, speed: 2.5, range: 150, atkSpeed: 1500, color: '#ef4444', isAoE: true, rarity: 'legendary' },
  pekka: { id: 'pekka', name: '페카', type: 'unit', cost: 7, hp: 3000, dmg: 300, speed: 1.5, range: 60, atkSpeed: 1800, color: '#1e3a8a', rarity: 'legendary' },
  arrows: { id: 'arrows', name: '화살비', type: 'spell', cost: 3, dmg: 150, radius: 250, color: '#94a3b8', rarity: 'common' },
  golem: { id: 'golem', name: '골렘', type: 'unit', cost: 8, hp: 4000, dmg: 150, speed: 1, range: 60, atkSpeed: 2000, color: '#78350f', rarity: 'legendary' },
  minions: { id: 'minions', name: '미니언', type: 'unit', cost: 3, hp: 150, dmg: 40, speed: 4, range: 50, atkSpeed: 800, color: '#3b82f6', count: 5, rarity: 'common' },
  wizard: { id: 'wizard', name: '마법사', type: 'unit', cost: 5, hp: 600, dmg: 120, speed: 2.5, range: 300, atkSpeed: 1400, color: '#d946ef', isAoE: true, rarity: 'rare' },
  meteor: { id: 'meteor', name: '메테오', type: 'spell', cost: 6, dmg: 800, radius: 200, color: '#f97316', rarity: 'legendary' },
  ninja: { id: 'ninja', name: '닌자', type: 'unit', cost: 4, hp: 400, dmg: 200, speed: 5, range: 50, atkSpeed: 500, color: '#111827', rarity: 'epic' },
  paladin: { id: 'paladin', name: '성기사', type: 'unit', cost: 5, hp: 1500, dmg: 80, speed: 2, range: 60, atkSpeed: 1200, color: '#fcd34d', rarity: 'rare' },
  bomb: { id: 'bomb', name: '폭탄', type: 'spell', cost: 2, dmg: 250, radius: 100, color: '#475569', rarity: 'common' },
  musketeer: { id: 'musketeer', name: '머스킷병', type: 'unit', cost: 4, hp: 500, dmg: 150, speed: 2.5, range: 500, atkSpeed: 1100, color: '#8b5cf6', rarity: 'rare' },
  bats: { id: 'bats', name: '박쥐', type: 'unit', cost: 2, hp: 80, dmg: 30, speed: 5, range: 40, atkSpeed: 600, color: '#64748b', count: 4, rarity: 'common' },
  dark_knight: { id: 'dark_knight', name: '다크나이트', type: 'unit', cost: 4, hp: 1000, dmg: 150, speed: 3.5, range: 60, atkSpeed: 1300, color: '#1e293b', isAoE: true, rarity: 'epic' },
  ice_golem: { id: 'ice_golem', name: '얼음 골렘', type: 'unit', cost: 2, hp: 1000, dmg: 20, speed: 2, range: 60, atkSpeed: 1500, color: '#bae6fd', rarity: 'rare' },
  poison: { id: 'poison', name: '독 마법', type: 'spell', cost: 4, dmg: 400, radius: 200, color: '#16a34a', duration: 8000, rarity: 'epic' },
  healer: { id: 'healer', name: '치유사', type: 'unit', cost: 4, hp: 800, dmg: 40, speed: 2.5, range: 300, atkSpeed: 1500, color: '#fef08a', rarity: 'rare' },
  vampire: { id: 'vampire', name: '뱀파이어', type: 'unit', cost: 5, hp: 900, dmg: 180, speed: 3.5, range: 60, atkSpeed: 1000, color: '#9f1239', rarity: 'epic' },
  mecha: { id: 'mecha', name: '메카', type: 'unit', cost: 6, hp: 2500, dmg: 200, speed: 2, range: 400, atkSpeed: 2000, color: '#64748b', isAoE: true, rarity: 'legendary' }
};

interface Player {
  id: string;
  team: 'red' | 'blue';
  name: string;
  mana: number;
  isBot: boolean;
  deck: string[];
  trophies: number;
  cardLevels: Record<string, number>;
}

interface Unit {
  id: string;
  ownerId: string;
  team: 'red' | 'blue';
  cardId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  freezeTime: number;
  rageTime: number;
  poisonTime: number;
  level: number;
}

interface Projectile {
  id: string;
  team: 'red' | 'blue';
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  targetId: string;
  targetType: 'unit' | 'base' | 'tower';
  isAoE?: boolean;
}

interface Effect {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
}

interface Base {
  team: 'red' | 'blue';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
  freezeTime: number;
  poisonTime: number;
}

interface Tower {
  id: string;
  team: 'red' | 'blue';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
  freezeTime: number;
  poisonTime: number;
}

const players: Record<string, Player> = {};
let units: Unit[] = [];
let projectiles: Projectile[] = [];
let effects: Effect[] = [];

let bases: Record<'red' | 'blue', Base> = {
  red: { team: 'red', x: 150, y: MAP_HEIGHT / 2, hp: 3000, maxHp: 3000, radius: 80, cooldown: 0, freezeTime: 0, poisonTime: 0 },
  blue: { team: 'blue', x: MAP_WIDTH - 150, y: MAP_HEIGHT / 2, hp: 3000, maxHp: 3000, radius: 80, cooldown: 0, freezeTime: 0, poisonTime: 0 }
};

let towers: Tower[] = [];

let matchState = {
  status: 'LOBBY', // 'LOBBY' | 'PLAYING' | 'GAMEOVER'
  winner: '',
  timeLeft: 120
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  function resetMatch() {
    matchState = { status: 'LOBBY', winner: '', timeLeft: 120 };
    units = [];
    projectiles = [];
    effects = [];
    bases.red.hp = bases.red.maxHp;
    bases.blue.hp = bases.blue.maxHp;
    bases.red.freezeTime = 0;
    bases.blue.freezeTime = 0;
    
    // 2 보호 타워 (위/아래 라인)
    towers = [
      { id: 'r_top', team: 'red', x: 400, y: 250, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'r_bot', team: 'red', x: 400, y: 650, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'b_top', team: 'blue', x: MAP_WIDTH - 400, y: 250, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
      { id: 'b_bot', team: 'blue', x: MAP_WIDTH - 400, y: 650, hp: 1500, maxHp: 1500, radius: 40, cooldown: 0, freezeTime: 0, poisonTime: 0 },
    ];

    for (const id in players) {
      players[id].mana = 5;
    }
    io.emit('syncMatch', matchState);
  }

  let botCounter = 1;
  function spawnBot(team: 'red' | 'blue', playerTrophies: number) {
    const id = 'bot_' + botCounter++;
    const allCardIds = Object.keys(CARDS);
    const botDeck = allCardIds.sort(() => 0.5 - Math.random()).slice(0, 6);
    
    const botLevel = 1 + Math.floor(playerTrophies / 100);
    const botCardLevels: Record<string, number> = {};
    botDeck.forEach(id => botCardLevels[id] = botLevel);

    players[id] = {
      id,
      team,
      name: `${team === 'red' ? '[RED]' : '[BLUE]'} AI`,
      mana: 5,
      isBot: true,
      deck: botDeck,
      trophies: playerTrophies,
      cardLevels: botCardLevels
    };
  }

  function maintainBots() {
    if (matchState.status !== 'PLAYING') return;
    const redPlayers = Object.values(players).filter(p => p.team === 'red');
    const bluePlayers = Object.values(players).filter(p => p.team === 'blue');

    let maxTrophies = 0;
    Object.values(players).forEach(p => { if (!p.isBot && p.trophies > maxTrophies) maxTrophies = p.trophies; });

    if (redPlayers.length === 0) spawnBot('red', maxTrophies);
    if (bluePlayers.length === 0) spawnBot('blue', maxTrophies);
  }

  // Bot AI Loop
  setInterval(() => {
    if (matchState.status !== 'PLAYING') return;
    
    for (const id in players) {
      const p = players[id];
      if (p.isBot && p.mana >= 3) {
        // Difficulty scaling: Higher trophies = faster decision making
        const decisionChance = Math.min(0.2, 0.05 + (p.trophies / 2000)); 
        
        if (Math.random() < decisionChance) {
          const cardId = p.deck[Math.floor(Math.random() * p.deck.length)];
          const card = CARDS[cardId];
          
          if (p.mana >= card.cost) {
            p.mana -= card.cost;
            
            const minX = p.team === 'red' ? 100 : MAP_WIDTH / 2 + 50;
            const maxX = p.team === 'red' ? MAP_WIDTH / 2 - 50 : MAP_WIDTH - 100;
            const x = minX + Math.random() * (maxX - minX);
            const y = Math.random() > 0.5 ? 250 + Math.random() * 100 : 650 - Math.random() * 100;

            playCardLogic(p, card, x, y);
          }
        }
      }
    }
  }, 200);

  function checkGameOver(timeUp = false) {
    if (matchState.status === 'GAMEOVER') return;
    
    let winner = '';
    if (bases.red.hp <= 0) winner = 'blue';
    else if (bases.blue.hp <= 0) winner = 'red';
    else if (timeUp) {
      if (bases.red.hp > bases.blue.hp) winner = 'red';
      else if (bases.blue.hp > bases.red.hp) winner = 'blue';
      else {
        // Check towers
        const redTowers = towers.filter(t => t.team === 'red' && t.hp > 0).length;
        const blueTowers = towers.filter(t => t.team === 'blue' && t.hp > 0).length;
        if (redTowers > blueTowers) winner = 'red';
        else if (blueTowers > redTowers) winner = 'blue';
        else winner = 'draw';
      }
    }

    if (winner !== '') {
      matchState.status = 'GAMEOVER';
      matchState.winner = winner;
      io.emit('syncMatch', matchState);
      
      // Send results to players
      for (const id in players) {
        const p = players[id];
        if (!p.isBot) {
          if (winner === p.team) {
            io.to(p.id).emit('matchResult', { result: 'win', trophyChange: 30, goldChange: 50 });
          } else if (winner === 'draw') {
            io.to(p.id).emit('matchResult', { result: 'draw', trophyChange: 0, goldChange: 20 });
          } else {
            io.to(p.id).emit('matchResult', { result: 'lose', trophyChange: -20, goldChange: 10 });
          }
        }
      }
    }
  }

  function playCardLogic(p: Player, card: CardDef, x: number, y: number) {
    const level = p.cardLevels[card.id] || 1;
    const mult = 1 + (level - 1) * 0.1;

    if (card.type === 'unit') {
      const count = card.count || 1;
      for (let i = 0; i < count; i++) {
        const offsetX = count > 1 ? (Math.random() * 40 - 20) : 0;
        const offsetY = count > 1 ? (Math.random() * 40 - 20) : 0;
        units.push({
          id: Math.random().toString(36).substr(2, 9),
          ownerId: p.id,
          team: p.team,
          cardId: card.id,
          x: x + offsetX,
          y: y + offsetY,
          hp: card.hp! * mult,
          maxHp: card.hp! * mult,
          cooldown: 0,
          freezeTime: 0,
          rageTime: 0,
          poisonTime: 0,
          level
        });
      }
    } else if (card.type === 'spell') {
      effects.push({ id: Math.random().toString(36).substr(2, 9), x, y, radius: 10, maxRadius: card.radius!, color: card.color });
      
      const damage = card.dmg * mult;

      if (card.id === 'freeze') {
        for (const u of units) {
          if (u.team !== p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) u.freezeTime = card.duration!;
        }
        for (const t of towers) {
          if (t.team !== p.team && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) t.freezeTime = card.duration!;
        }
        const enemyBase = p.team === 'red' ? bases.blue : bases.red;
        if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) enemyBase.freezeTime = card.duration!;
      } else if (card.id === 'rage') {
        for (const u of units) {
          if (u.team === p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) u.rageTime = card.duration!;
        }
      } else if (card.id === 'poison') {
        for (const u of units) {
          if (u.team !== p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) u.poisonTime = card.duration!;
        }
        for (const t of towers) {
          if (t.team !== p.team && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) t.poisonTime = card.duration!;
        }
        const enemyBase = p.team === 'red' ? bases.blue : bases.red;
        if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) enemyBase.poisonTime = card.duration!;
      } else if (card.id === 'lightning') {
        // Hit up to targetCount enemies with highest HP
        let targets: any[] = [];
        for (const u of units) {
          if (u.team !== p.team && Math.hypot(u.x - x, u.y - y) <= card.radius!) targets.push({ type: 'unit', obj: u });
        }
        for (const t of towers) {
          if (t.team !== p.team && t.hp > 0 && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) targets.push({ type: 'tower', obj: t });
        }
        const enemyBase = p.team === 'red' ? bases.blue : bases.red;
        if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) targets.push({ type: 'base', obj: enemyBase });
        
        targets.sort((a, b) => b.obj.hp - a.obj.hp);
        targets.slice(0, card.targetCount!).forEach(t => {
          t.obj.hp -= damage;
          io.emit('damageText', { x: t.obj.x, y: t.obj.y, amount: Math.floor(damage), color: '#ef4444' });
        });
        checkGameOver();
      } else {
        // Fireball or Heal
        const isHeal = damage < 0;
        const amount = Math.abs(damage);

        for (const u of units) {
          if ((isHeal ? u.team === p.team : u.team !== p.team) && Math.hypot(u.x - x, u.y - y) <= card.radius!) {
            if (isHeal) {
              u.hp = Math.min(u.maxHp, u.hp + amount);
              io.emit('damageText', { x: u.x, y: u.y, amount: Math.floor(amount), color: '#22c55e' });
            } else {
              u.hp -= amount;
              io.emit('damageText', { x: u.x, y: u.y, amount: Math.floor(amount), color: '#ef4444' });
            }
          }
        }
        if (!isHeal) {
          for (const t of towers) {
            if (t.team !== p.team && t.hp > 0 && Math.hypot(t.x - x, t.y - y) <= card.radius! + t.radius) {
              t.hp -= amount;
              io.emit('damageText', { x: t.x, y: t.y, amount: Math.floor(amount), color: '#ef4444' });
            }
          }
          const enemyBase = p.team === 'red' ? bases.blue : bases.red;
          if (Math.hypot(enemyBase.x - x, enemyBase.y - y) <= card.radius! + enemyBase.radius) {
            enemyBase.hp -= amount;
            io.emit('damageText', { x: enemyBase.x, y: enemyBase.y, amount: Math.floor(amount), color: '#ef4444' });
            checkGameOver();
          }
        }
      }
    }
  }

  // Main Game Loop
  setInterval(() => {
    if (matchState.status !== 'PLAYING') return;

    // Timer removed
    // matchState.timeLeft -= TICK_RATE / 1000;
    // if (matchState.timeLeft <= 0) { ... }

    // Mana Regen (Base 1 mana per 2 seconds, scales slightly with trophies for bots)
    for (const id in players) {
      const p = players[id];
      let regenRate = 1 / (2000 / TICK_RATE);
      if (p.isBot) {
        regenRate *= (1 + (p.trophies / 1000)); // Bots get slightly more mana at high trophies
      }
      p.mana = Math.min(10, p.mana + regenRate);
    }

    // Update Units
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.hp <= 0) {
        units.splice(i, 1);
        continue;
      }

      const stats = CARDS[u.cardId];
      
      if (u.freezeTime > 0) {
        u.freezeTime -= TICK_RATE;
        continue; // Skip move and attack
      }

      if (u.poisonTime > 0) {
        u.poisonTime -= TICK_RATE;
        u.hp -= (400 / (8000 / TICK_RATE)); // 400 damage over 8 seconds
        if (Math.random() < 0.1) io.emit('damageText', { x: u.x, y: u.y, amount: 5, color: '#16a34a' });
      }

      let currentSpeed = stats.speed!;
      let currentAtkSpeed = stats.atkSpeed!;
      if (u.rageTime > 0) {
        u.rageTime -= TICK_RATE;
        currentSpeed *= 1.5;
        currentAtkSpeed *= 0.6; // Faster attack
      }

      if (u.cooldown > 0) u.cooldown -= TICK_RATE;

      let target: { x: number, y: number, type: 'unit'|'base'|'tower', id: string } | null = null;
      let minDist = Infinity;

      // Check enemy units
      for (const enemy of units) {
        if (enemy.team !== u.team && enemy.hp > 0) {
          const dist = Math.hypot(enemy.x - u.x, enemy.y - u.y);
          if (dist < minDist && dist < 600) {
            minDist = dist;
            target = { x: enemy.x, y: enemy.y, type: 'unit', id: enemy.id };
          }
        }
      }

      // Check enemy towers
      for (const t of towers) {
        if (t.team !== u.team && t.hp > 0) {
          const dist = Math.hypot(t.x - u.x, t.y - u.y) - t.radius;
          if (dist < minDist) {
            minDist = dist;
            target = { x: t.x, y: t.y, type: 'tower', id: t.id };
          }
        }
      }

      // Check enemy base
      const enemyBase = u.team === 'red' ? bases.blue : bases.red;
      const baseDist = Math.hypot(enemyBase.x - u.x, enemyBase.y - u.y) - enemyBase.radius;
      if (baseDist < minDist) {
        minDist = baseDist;
        target = { x: enemyBase.x, y: enemyBase.y, type: 'base', id: enemyBase.team };
      }

      if (target) {
        const attackRange = stats.range!;
        if (minDist <= attackRange) {
          // Attack
          if (u.cooldown <= 0) {
            u.cooldown = currentAtkSpeed;
            
            if (stats.range! > 100) {
              const angle = Math.atan2(target.y - u.y, target.x - u.x);
              projectiles.push({
                id: Math.random().toString(36).substr(2, 9),
                team: u.team,
                x: u.x, y: u.y,
                vx: Math.cos(angle) * (stats.id === 'sniper' ? 25 : 15),
                vy: Math.sin(angle) * (stats.id === 'sniper' ? 25 : 15),
                damage: stats.dmg * (1 + (u.level - 1) * 0.1),
                targetId: target.id,
                targetType: target.type,
                isAoE: stats.isAoE
              });
            } else {
              // Melee
              const damage = stats.dmg * (1 + (u.level - 1) * 0.1);
              if (stats.isAoE) {
                // Valkyrie AoE logic
                for (const eu of units) {
                  if (eu.team !== u.team && Math.hypot(eu.x - u.x, eu.y - u.y) <= stats.range!) {
                    eu.hp -= damage;
                    io.emit('damageText', { x: eu.x, y: eu.y, amount: Math.floor(damage), color: '#ef4444' });
                  }
                }
                for (const t of towers) {
                  if (t.team !== u.team && t.hp > 0 && Math.hypot(t.x - u.x, t.y - u.y) <= stats.range! + t.radius) {
                    t.hp -= damage;
                    io.emit('damageText', { x: t.x, y: t.y, amount: Math.floor(damage), color: '#ef4444' });
                  }
                }
                if (Math.hypot(enemyBase.x - u.x, enemyBase.y - u.y) <= stats.range! + enemyBase.radius) {
                  enemyBase.hp -= damage;
                  io.emit('damageText', { x: enemyBase.x, y: enemyBase.y, amount: Math.floor(damage), color: '#ef4444' });
                  checkGameOver();
                }
              } else {
                // Single target melee
                if (target.type === 'base') {
                  enemyBase.hp -= damage;
                  io.emit('damageText', { x: enemyBase.x, y: enemyBase.y, amount: Math.floor(damage), color: '#ef4444' });
                  checkGameOver();
                } else if (target.type === 'tower') {
                  const t = towers.find(tw => tw.id === target!.id);
                  if (t) {
                    t.hp -= damage;
                    io.emit('damageText', { x: t.x, y: t.y, amount: Math.floor(damage), color: '#ef4444' });
                  }
                } else {
                  const enemyUnit = units.find(eu => eu.id === target!.id);
                  if (enemyUnit) {
                    enemyUnit.hp -= damage;
                    io.emit('damageText', { x: enemyUnit.x, y: enemyUnit.y, amount: Math.floor(damage), color: '#ef4444' });
                  }
                }
              }
            }
          }
        } else {
          // Move directly to target
          const angle = Math.atan2(target.y - u.y, target.x - u.x);
          u.x += Math.cos(angle) * currentSpeed;
          u.y += Math.sin(angle) * currentSpeed;
        }
      }

      u.x = Math.max(0, Math.min(MAP_WIDTH, u.x));
      u.y = Math.max(0, Math.min(MAP_HEIGHT, u.y));
    }

    // Tower Attacks
    for (const t of towers) {
      if (t.hp <= 0) continue;
      if (t.poisonTime > 0) {
        t.poisonTime -= TICK_RATE;
        t.hp -= (400 / (8000 / TICK_RATE));
        if (Math.random() < 0.1) io.emit('damageText', { x: t.x, y: t.y, amount: 5, color: '#16a34a' });
      }
      if (t.freezeTime > 0) { t.freezeTime -= TICK_RATE; continue; }
      
      if (t.cooldown > 0) t.cooldown -= TICK_RATE;
      if (t.cooldown <= 0) {
        let closestUnit = null;
        let minDist = 400; // Tower range
        for (const u of units) {
          if (u.team !== t.team && u.hp > 0) {
            const dist = Math.hypot(u.x - t.x, u.y - t.y);
            if (dist < minDist) { minDist = dist; closestUnit = u; }
          }
        }
        if (closestUnit) {
          t.cooldown = 1000;
          const angle = Math.atan2(closestUnit.y - t.y, closestUnit.x - t.x);
          projectiles.push({
            id: Math.random().toString(), team: t.team, x: t.x, y: t.y,
            vx: Math.cos(angle) * 15, vy: Math.sin(angle) * 15,
            damage: 50, targetId: closestUnit.id, targetType: 'unit'
          });
        }
      }
    }

    // Base Attacks
    for (const team of ['red', 'blue'] as const) {
      const base = bases[team];
      if (base.hp <= 0) continue;
      if (base.poisonTime > 0) {
        base.poisonTime -= TICK_RATE;
        base.hp -= (400 / (8000 / TICK_RATE));
        if (Math.random() < 0.1) io.emit('damageText', { x: base.x, y: base.y, amount: 5, color: '#16a34a' });
      }
      if (base.freezeTime > 0) { base.freezeTime -= TICK_RATE; continue; }

      if (base.cooldown > 0) base.cooldown -= TICK_RATE;
      if (base.cooldown <= 0) {
        let closestUnit = null;
        let minDist = 450; // Base range
        for (const u of units) {
          if (u.team !== base.team && u.hp > 0) {
            const dist = Math.hypot(u.x - base.x, u.y - base.y);
            if (dist < minDist) { minDist = dist; closestUnit = u; }
          }
        }
        if (closestUnit) {
          base.cooldown = 1000;
          const angle = Math.atan2(closestUnit.y - base.y, closestUnit.x - base.x);
          projectiles.push({
            id: Math.random().toString(), team: base.team, x: base.x, y: base.y,
            vx: Math.cos(angle) * 15, vy: Math.sin(angle) * 15,
            damage: 80, targetId: closestUnit.id, targetType: 'unit'
          });
        }
      }
    }

    // Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx;
      p.y += p.vy;

      let hit = false;
      let hitX = p.x;
      let hitY = p.y;

      if (p.targetType === 'base') {
        const base = p.team === 'red' ? bases.blue : bases.red;
        if (Math.hypot(base.x - p.x, base.y - p.y) <= base.radius) {
          hit = true;
          hitX = base.x; hitY = base.y;
        }
      } else if (p.targetType === 'tower') {
        const t = towers.find(tw => tw.id === p.targetId);
        if (t && Math.hypot(t.x - p.x, t.y - p.y) <= t.radius) {
          hit = true;
          hitX = t.x; hitY = t.y;
        } else if (!t) {
          hit = true;
        }
      } else {
        const targetUnit = units.find(u => u.id === p.targetId);
        if (targetUnit && Math.hypot(targetUnit.x - p.x, targetUnit.y - p.y) <= 20) {
          hit = true;
          hitX = targetUnit.x; hitY = targetUnit.y;
        } else if (!targetUnit) {
          hit = true;
        }
      }

      if (hit) {
        if (p.isAoE) {
          // AoE Damage
          for (const eu of units) {
            if (eu.team !== p.team && Math.hypot(eu.x - hitX, eu.y - hitY) <= 100) {
              eu.hp -= p.damage;
              io.emit('damageText', { x: eu.x, y: eu.y, amount: Math.floor(p.damage), color: '#ef4444' });
            }
          }
          for (const t of towers) {
            if (t.team !== p.team && t.hp > 0 && Math.hypot(t.x - hitX, t.y - hitY) <= 100 + t.radius) {
              t.hp -= p.damage;
              io.emit('damageText', { x: t.x, y: t.y, amount: Math.floor(p.damage), color: '#ef4444' });
            }
          }
          const enemyBase = p.team === 'red' ? bases.blue : bases.red;
          if (Math.hypot(enemyBase.x - hitX, enemyBase.y - hitY) <= 100 + enemyBase.radius) {
            enemyBase.hp -= p.damage;
            io.emit('damageText', { x: enemyBase.x, y: enemyBase.y, amount: Math.floor(p.damage), color: '#ef4444' });
            checkGameOver();
          }
        } else {
          // Single Target Damage
          if (p.targetType === 'base') {
            const base = p.team === 'red' ? bases.blue : bases.red;
            base.hp -= p.damage;
            io.emit('damageText', { x: base.x, y: base.y, amount: Math.floor(p.damage), color: '#ef4444' });
            checkGameOver();
          } else if (p.targetType === 'tower') {
            const t = towers.find(tw => tw.id === p.targetId);
            if (t) {
              t.hp -= p.damage;
              io.emit('damageText', { x: t.x, y: t.y, amount: Math.floor(p.damage), color: '#ef4444' });
            }
          } else {
            const targetUnit = units.find(u => u.id === p.targetId);
            if (targetUnit) {
              targetUnit.hp -= p.damage;
              io.emit('damageText', { x: targetUnit.x, y: targetUnit.y, amount: Math.floor(p.damage), color: '#ef4444' });
            }
          }
        }
      }

      if (hit || p.x < 0 || p.x > MAP_WIDTH || p.y < 0 || p.y > MAP_HEIGHT) {
        projectiles.splice(i, 1);
      }
    }

    // Update Effects
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.radius += (e.maxRadius / (300 / TICK_RATE));
      if (e.radius >= e.maxRadius) {
        effects.splice(i, 1);
      }
    }

    io.emit("sync", { players, units, projectiles, effects, bases, towers });

  }, TICK_RATE);

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.emit("init", { id: socket.id, map: { width: MAP_WIDTH, height: MAP_HEIGHT }, cards: CARDS });
    socket.emit("syncMatch", matchState);

    socket.on("joinGame", (data: { team: 'red'|'blue', name: string, deck: string[], trophies: number, cardLevels: Record<string, number> }) => {
      // If a game is already over or not started, reset it
      if (matchState.status !== 'PLAYING') {
        resetMatch();
        matchState.status = 'PLAYING';
      }

      players[socket.id] = {
        id: socket.id,
        team: data.team,
        name: data.name || `사령관 ${Math.floor(Math.random() * 1000)}`,
        mana: 5,
        isBot: false,
        deck: data.deck,
        trophies: data.trophies,
        cardLevels: data.cardLevels || {}
      };
      
      maintainBots();
      io.emit('syncMatch', matchState);
    });

    socket.on("leaveGame", () => {
      delete players[socket.id];
      // If no real players left, end game
      if (Object.values(players).filter(p => !p.isBot).length === 0) {
        matchState.status = 'LOBBY';
        io.emit('syncMatch', matchState);
      }
    });

    socket.on("playCard", (data: { cardId: string, x: number, y: number }) => {
      const p = players[socket.id];
      if (!p || matchState.status !== 'PLAYING') return;

      const card = CARDS[data.cardId];
      if (!card || p.mana < card.cost) return;

      if (p.team === 'red' && data.x > MAP_WIDTH / 2) return;
      if (p.team === 'blue' && data.x < MAP_WIDTH / 2) return;

      p.mana -= card.cost;
      playCardLogic(p, card, data.x, data.y);
    });

    socket.on("disconnect", () => {
      delete players[socket.id];
      if (Object.values(players).filter(p => !p.isBot).length === 0) {
        matchState.status = 'LOBBY';
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}

startServer();
