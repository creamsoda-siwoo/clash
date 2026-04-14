export interface CardDef {
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
  count?: number;
  isAoE?: boolean;
  duration?: number;
  targetCount?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface TierInfo {
  name: string;
  minTrophies: number;
  color: string;
  icon: string;
}

export const TIERS: TierInfo[] = [
  { name: '브론즈', minTrophies: 0, color: '#cd7f32', icon: '🥉' },
  { name: '실버', minTrophies: 500, color: '#c0c0c0', icon: '🥈' },
  { name: '골드', minTrophies: 1000, color: '#ffd700', icon: '🥇' },
  { name: '플래티넘', minTrophies: 1500, color: '#e5e4e2', icon: '💎' },
  { name: '다이아몬드', minTrophies: 2000, color: '#b9f2ff', icon: '🔷' },
  { name: '마스터', minTrophies: 3000, color: '#ff00ff', icon: '🔮' },
  { name: '그랜드마스터', minTrophies: 4000, color: '#00ffff', icon: '👑' },
];

export const getTier = (trophies: number): TierInfo => {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (trophies >= TIERS[i].minTrophies) return TIERS[i];
  }
  return TIERS[0];
};

export const CARDS: Record<string, CardDef> = {
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
  cannon: { id: 'cannon', name: '대포', type: 'unit', cost: 3, hp: 600, dmg: 120, speed: 0, range: 450, atkSpeed: 1200, color: '#475569', rarity: 'rare' },
  electro_wizard: { id: 'electro_wizard', name: '일렉트로 마법사', type: 'unit', cost: 4, hp: 600, dmg: 80, speed: 3, range: 350, atkSpeed: 1500, color: '#60a5fa', targetCount: 2, rarity: 'legendary' },
  log: { id: 'log', name: '통나무', type: 'spell', cost: 2, dmg: 100, radius: 100, color: '#78350f', rarity: 'legendary' },
  sparky: { id: 'sparky', name: '스파키', type: 'unit', cost: 6, hp: 1200, dmg: 1100, speed: 1.5, range: 400, atkSpeed: 4000, color: '#facc15', isAoE: true, rarity: 'legendary' },
  mini_pekka: { id: 'mini_pekka', name: '미니 페카', type: 'unit', cost: 4, hp: 1100, dmg: 600, speed: 4, range: 60, atkSpeed: 1600, color: '#312e81', rarity: 'rare' },
  mega_knight: { id: 'mega_knight', name: '메가 나이트', type: 'unit', cost: 7, hp: 3300, dmg: 220, speed: 3, range: 80, atkSpeed: 1700, color: '#334155', isAoE: true, rarity: 'legendary' },
  graveyard: { id: 'graveyard', name: '무덤', type: 'spell', cost: 5, dmg: 0, radius: 250, color: '#94a3b8', count: 15, rarity: 'epic' },
  hog_rider: { id: 'hog_rider', name: '호그 라이더', type: 'unit', cost: 4, hp: 1400, dmg: 260, speed: 6, range: 60, atkSpeed: 1600, color: '#78350f', rarity: 'rare' },
  inferno_tower: { id: 'inferno_tower', name: '인페르노 타워', type: 'unit', cost: 5, hp: 1400, dmg: 30, speed: 0, range: 450, atkSpeed: 400, color: '#ea580c', rarity: 'rare' },
  electro_giant: { id: 'electro_giant', name: '일렉트로 자이언트', type: 'unit', cost: 7, hp: 3500, dmg: 150, speed: 1.5, range: 60, atkSpeed: 2100, color: '#3b82f6', isAoE: true, rarity: 'legendary' },
  phoenix: { id: 'phoenix', name: '피닉스', type: 'unit', cost: 4, hp: 800, dmg: 120, speed: 3, range: 150, atkSpeed: 900, color: '#f97316', rarity: 'legendary' },
  barbarians: { id: 'barbarians', name: '바바리안', type: 'unit', cost: 5, hp: 600, dmg: 50, speed: 2.5, range: 50, atkSpeed: 1000, color: '#fde047', count: 5, rarity: 'rare' },
  witch: { id: 'witch', name: '마녀', type: 'unit', cost: 5, hp: 800, dmg: 60, speed: 2.5, range: 400, atkSpeed: 700, color: '#a855f7', isAoE: true, rarity: 'rare' },
  ice_spirit: { id: 'ice_spirit', name: '아이스 스피릿', type: 'unit', cost: 1, hp: 200, dmg: 50, speed: 4, range: 50, atkSpeed: 1000, color: '#7dd3fc', rarity: 'common' },
  fire_spirit: { id: 'fire_spirit', name: '파이어 스피릿', type: 'unit', cost: 1, hp: 200, dmg: 80, speed: 4, range: 50, atkSpeed: 1000, color: '#fb923c', isAoE: true, rarity: 'common' },
  bandit: { id: 'bandit', name: '도둑', type: 'unit', cost: 3, hp: 750, dmg: 160, speed: 5, range: 40, atkSpeed: 1000, color: '#1e293b', rarity: 'epic' },
  giant_skeleton: { id: 'giant_skeleton', name: '자이언트 해골', type: 'unit', cost: 6, hp: 2500, dmg: 250, speed: 1.5, range: 60, atkSpeed: 2000, color: '#e2e8f0', rarity: 'epic' },
  goblins: { id: 'goblins', name: '고블린', type: 'unit', cost: 2, hp: 200, dmg: 50, speed: 4.5, range: 40, atkSpeed: 800, color: '#4ade80', count: 3, rarity: 'common' },
  princess: { id: 'princess', name: '프린세스', type: 'unit', cost: 3, hp: 250, dmg: 140, speed: 2, range: 700, atkSpeed: 3000, color: '#fb7185', isAoE: true, rarity: 'legendary' },
  royal_giant: { id: 'royal_giant', name: '로얄 자이언트', type: 'unit', cost: 6, hp: 2500, dmg: 120, speed: 1.5, range: 450, atkSpeed: 1700, color: '#fcd34d', rarity: 'rare' },
  miner: { id: 'miner', name: '광부', type: 'unit', cost: 3, hp: 1000, dmg: 120, speed: 3, range: 60, atkSpeed: 1200, color: '#78350f', rarity: 'legendary' },
  rocket: { id: 'rocket', name: '로켓', type: 'spell', cost: 6, dmg: 1000, radius: 120, color: '#475569', rarity: 'epic' },
  executioner: { id: 'executioner', name: '도끼맨', type: 'unit', cost: 5, hp: 1000, dmg: 80, speed: 2, range: 300, atkSpeed: 1500, color: '#991b1b', isAoE: true, rarity: 'rare' },
  balloon: { id: 'balloon', name: '해골 비행선', type: 'unit', cost: 5, hp: 1400, dmg: 800, speed: 2, range: 60, atkSpeed: 3000, color: '#94a3b8', rarity: 'epic' },
  electro_spirit: { id: 'electro_spirit', name: '일렉트로 스피릿', type: 'unit', cost: 1, hp: 200, dmg: 40, speed: 4, range: 50, atkSpeed: 1000, color: '#60a5fa', rarity: 'common' },
  night_witch: { id: 'night_witch', name: '암흑 마녀', type: 'unit', cost: 4, hp: 750, dmg: 260, speed: 2.5, range: 60, atkSpeed: 1300, color: '#4c1d95', rarity: 'legendary' },
  inferno_dragon: { id: 'inferno_dragon', name: '인페르노 드래곤', type: 'unit', cost: 4, hp: 1000, dmg: 100, speed: 2.5, range: 350, atkSpeed: 400, color: '#16a34a', rarity: 'legendary' },
  zap: { id: 'zap', name: '감전 마법', type: 'spell', cost: 2, dmg: 80, radius: 100, color: '#7dd3fc', rarity: 'common' },
  tornado: { id: 'tornado', name: '토네이도', type: 'spell', cost: 3, dmg: 100, radius: 250, color: '#94a3b8', duration: 3000, rarity: 'epic' },
  ram_rider: { id: 'ram_rider', name: '램 라이더', type: 'unit', cost: 5, hp: 1500, dmg: 220, speed: 4, range: 60, atkSpeed: 1100, color: '#7c3aed', rarity: 'legendary' },
  magic_archer: { id: 'magic_archer', name: '매직 아처', type: 'unit', cost: 4, hp: 440, dmg: 100, speed: 2.5, range: 700, atkSpeed: 1100, color: '#ea580c', isAoE: true, rarity: 'legendary' },
  ice_wizard: { id: 'ice_wizard', name: '얼음 마법사', type: 'unit', cost: 3, hp: 600, dmg: 75, speed: 2.5, range: 450, atkSpeed: 1700, color: '#bae6fd', isAoE: true, rarity: 'legendary' },
  mega_pekka: { id: 'mega_pekka', name: '메가 페카', type: 'unit', cost: 9, hp: 5000, dmg: 800, speed: 1.2, range: 70, atkSpeed: 2000, color: '#000000', rarity: 'legendary' },
};
