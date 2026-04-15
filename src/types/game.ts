export interface Player {
  id: string;
  team: 'red' | 'blue';
  name: string;
  mana: number;
  isBot: boolean;
  deck: string[];
  hand?: string[]; // Optional for backward compatibility
  nextCard?: string;
  trophies: number;
  userId?: string;
}

export interface Unit {
  id: string;
  team: 'red' | 'blue';
  cardId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  targetX?: number;
  targetY?: number;
  freezeTime: number;
  rageTime: number;
}

export interface Projectile {
  id: string;
  team: 'red' | 'blue';
  x: number;
  y: number;
}

export interface Effect {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
}

export interface Base {
  team: 'red' | 'blue';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  freezeTime: number;
}

export interface Tower {
  id: string;
  team: 'red' | 'blue';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  freezeTime: number;
}

export interface MatchState {
  status: 'LOBBY' | 'PLAYING' | 'GAMEOVER' | 'ENDED';
  winner: string;
  timeLeft: number;
  isDoubleMana?: boolean;
  isOvertime?: boolean;
  theme?: 'DEFAULT' | 'LAVA' | 'ICE' | 'FOREST';
  isPvP?: boolean;
  isPaused?: boolean;
}

export interface Emote {
  id: string;
  playerId: string;
  team: 'red' | 'blue';
  emote: string;
  life: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  amount: number;
  color: string;
  life: number;
}

export interface Mission {
  id: string;
  desc: string;
  target: number;
  current: number;
  reward: number;
  completed: boolean;
}

export interface PachinkoResult {
  amount: number;
  type: 'gold' | 'fragments';
}
