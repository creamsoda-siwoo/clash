import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Trophy, Shield, Swords, Target, Zap, Plus, Crosshair, Snowflake, Flame, Skull, Home, Droplets, Heart, Cpu, Loader2, Smile, Users, Coins, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { CARDS, CardDef } from '../constants';

interface Player {
  id: string;
  team: 'red' | 'blue';
  name: string;
  mana: number;
  isBot: boolean;
  deck: string[];
}

interface Unit {
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

interface Projectile {
  id: string;
  team: 'red' | 'blue';
  x: number;
  y: number;
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
  freezeTime: number;
}

interface Tower {
  id: string;
  team: 'red' | 'blue';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  freezeTime: number;
}

interface MatchState {
  status: 'LOBBY' | 'PLAYING' | 'GAMEOVER';
  winner: string;
  timeLeft: number;
  isDoubleMana?: boolean;
  isOvertime?: boolean;
  theme?: 'DEFAULT' | 'LAVA' | 'ICE' | 'FOREST';
  isPvP?: boolean;
  isPaused?: boolean;
}

interface Emote {
  id: string;
  playerId: string;
  team: 'red' | 'blue';
  emote: string;
  life: number;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  amount: number;
  color: string;
  life: number;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [units, setUnits] = useState<Unit[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [bases, setBases] = useState<Record<'red' | 'blue', Base>>({
    red: { team: 'red', x: 150, y: 450, hp: 3000, maxHp: 3000, radius: 80, freezeTime: 0 },
    blue: { team: 'blue', x: 1450, y: 450, hp: 3000, maxHp: 3000, radius: 80, freezeTime: 0 }
  });
  const [towers, setTowers] = useState<Tower[]>([]);

  const [myId, setMyId] = useState<string>('');
  const [mapInfo, setMapInfo] = useState({ width: 1600, height: 900 });
  const [cardsDef, setCardsDef] = useState<Record<string, CardDef>>(CARDS);
  const [matchState, setMatchState] = useState<MatchState>({ status: 'LOBBY', winner: '', timeLeft: 180, isDoubleMana: false, isOvertime: false, isPvP: false });
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [notification, setNotification] = useState<{ message: string, color: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isFetchingLeaderboard, setIsFetchingLeaderboard] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showEmoteMenu, setShowEmoteMenu] = useState(false);

  const [showLobby, setShowLobby] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // New States for Deck & Trophies
  const [trophies, setTrophies] = useState<number>(0);
  const [gold, setGold] = useState<number>(0);
  const [cardLevels, setCardLevels] = useState<Record<string, number>>({});
  const [unlockedCards, setUnlockedCards] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'BATTLE' | 'DECK' | 'SHOP' | 'SYNTHESIS' | 'PACHINKO' | 'USERS'>('BATTLE');
  const [pachinkoResult, setPachinkoResult] = useState<{ amount: number, type: 'gold' | 'fragments' } | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<string[]>([]);
  const [matchResultInfo, setMatchResultInfo] = useState<{ result: string, trophyChange: number, goldChange: number } | null>(null);
  const [gachaResult, setGachaResult] = useState<{ cardId: string, isNew: boolean, isSynthesis?: boolean } | null>(null);
  const [fragments, setFragments] = useState<Record<string, number>>({ common: 0, rare: 0, epic: 0, legendary: 0 });
  const [level, setLevel] = useState<number>(1);
  const [xp, setXp] = useState<number>(0);
  const [missions, setMissions] = useState<{ id: string, desc: string, target: number, current: number, reward: number, completed: boolean }[]>([]);
  const [shopCards, setShopCards] = useState<string[]>(['knight', 'archer', 'giant']);
  const [claimedTrophyRewards, setClaimedTrophyRewards] = useState<number[]>([]);
  const trophyMilestones = [
    { trophies: 100, reward: 500, label: '500 Gold' },
    { trophies: 300, reward: 1000, label: '1000 Gold' },
    { trophies: 500, reward: 2000, label: '2000 Gold' },
    { trophies: 1000, reward: 5000, label: '5000 Gold' },
    { trophies: 2000, reward: 10000, label: '10000 Gold' },
  ];

  // Auth States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasClaimedDailyBonus, setHasClaimedDailyBonus] = useState<boolean>(false);
  useEffect(() => {
    if (isLoggedIn && missions.length === 0 && !hasClaimedDailyBonus) {
      setMissions([
        { id: 'win_1', desc: '전투 1회 완료', target: 1, current: 0, reward: 50, completed: false },
        { id: 'trophy_10', desc: '트로피 10점 획득', target: 10, current: 0, reward: 100, completed: false },
        { id: 'gacha_1', desc: '카드 1회 뽑기', target: 1, current: 0, reward: 30, completed: false }
      ]);
    }
  }, [isLoggedIn, missions.length, hasClaimedDailyBonus]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const updateMission = (id: string, amount: number) => {
    setMissions(prev => prev.map(m => {
      if (m.id.startsWith(id)) {
        const newCurrent = Math.min(m.target, m.current + amount);
        return { ...m, current: newCurrent, completed: newCurrent >= m.target };
      }
      return m;
    }));
  };
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAppReady, setIsAppReady] = useState(false);
  const [playerName, setPlayerName] = useState('');

  const mousePos = useRef({ x: 0, y: 0 });
  const unitsRef = useRef<Unit[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  const saveToServer = async (data: any) => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        ...data,
        uid: auth.currentUser.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error('Firestore save error:', e);
    }
  };

  const handleGacha = (count: number) => {
    const cost = count === 10 ? 900 : 100 * count;
    if (gold < cost) return;

    const newGold = gold - cost;
    setGold(newGold);
    
    // Use local references to update properly in a loop
    let currentUnlocked = [...unlockedCards];
    let currentFragments = { ...fragments };
    const results: { cardId: string, isNew: boolean }[] = [];

    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let targetRarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';
      
      // Better rates for 10-pulls? (Optional, but let's stick to standard for now or slight boost)
      const legendaryChance = count === 10 ? 0.05 : 0.02;
      const epicChance = count === 10 ? 0.15 : 0.10;
      
      if (rand > 1 - legendaryChance) targetRarity = 'legendary';
      else if (rand > 1 - legendaryChance - epicChance) targetRarity = 'epic';
      else if (rand > 0.5) targetRarity = 'rare';

      const pool = (Object.values(CARDS) as CardDef[]).filter(c => c.rarity === targetRarity);
      const drawn = pool[Math.floor(Math.random() * pool.length)];
      
      const isNew = !currentUnlocked.includes(drawn.id);
      if (isNew) {
        currentUnlocked.push(drawn.id);
      } else {
        currentFragments[targetRarity] = (currentFragments[targetRarity] || 0) + 1;
      }
      results.push({ cardId: drawn.id, isNew });
    }

    setUnlockedCards(currentUnlocked);
    setFragments(currentFragments);
    saveToServer({ gold: newGold, unlockedCards: currentUnlocked, fragments: currentFragments });
    setGachaResult(count === 1 ? results[0] : results);
    updateMission('gacha', count);
    
    if (count === 10) {
      setNotification({ message: '10회 연속 소환 완료!', color: '#a855f7' });
    }
  };

  const refreshShop = () => {
    const refreshCost = 50;
    if (gold >= refreshCost) {
      const newGold = gold - refreshCost;
      setGold(newGold);
      const allCardIds = Object.keys(CARDS);
      const newShopCards = allCardIds.sort(() => 0.5 - Math.random()).slice(0, 3);
      setShopCards(newShopCards);
      saveToServer({ gold: newGold, shopCards: newShopCards });
      setNotification({ message: '상점이 갱신되었습니다! (-50G)', color: '#3b82f6' });
    } else {
      setNotification({ message: '골드가 부족합니다!', color: '#ef4444' });
    }
  };

  const claimTrophyReward = (milestone: number, amount: number) => {
    if (trophies >= milestone && !claimedTrophyRewards.includes(milestone)) {
      const newGold = gold + amount;
      const newClaimed = [...claimedTrophyRewards, milestone];
      setGold(newGold);
      setClaimedTrophyRewards(newClaimed);
      saveToServer({ gold: newGold, claimedTrophyRewards: newClaimed });
      setNotification({ message: `트로피 보상 획득! +${amount} Gold`, color: '#facc15' });
    }
  };

  // Sync profile with server whenever socket or user data changes
  const fetchLeaderboard = async () => {
    setIsFetchingLeaderboard(true);
    try {
      const q = query(collection(db, 'users'), orderBy('trophies', 'desc'), limit(20));
      const querySnapshot = await getDocs(q);
      const users: any[] = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      setLeaderboard(users);
    } catch (e) {
      console.error('Error fetching leaderboard:', e);
    }
    setIsFetchingLeaderboard(false);
  };

  // Sync profile with server whenever socket or user data changes
  useEffect(() => {
    if (socket && isLoggedIn && playerName) {
      socket.emit('updateProfile', { name: playerName, trophies: trophies });
    }
  }, [socket, isLoggedIn, playerName, trophies]);

  useEffect(() => {
    if (activeTab === 'USERS') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let userData: any;
        const defaultCards = ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons', 'zap'];

        if (userDoc.exists()) {
          userData = userDoc.data();
          setPlayerName(userData.username);
          setTrophies(userData.trophies || 0);
          setGold(userData.gold || 0);
          setLevel(userData.level || 1);
          setXp(userData.xp || 0);
          setCardLevels(userData.cardLevels || {});

          const loadedUnlocked = userData.unlockedCards || [];
          const loadedDeck = userData.selectedDeck || [];

          // Strictly use loaded data
          const finalUnlocked = loadedUnlocked.length > 0 ? loadedUnlocked : defaultCards;
          const finalDeck = loadedDeck.length <= 6 ? loadedDeck : [];

          setUnlockedCards(finalUnlocked);
          setSelectedDeck(finalDeck);
          setFragments(userData.fragments || { common: 0, rare: 0, epic: 0, legendary: 0 });
          setShopCards(userData.shopCards || ['knight', 'archer', 'giant']);
          setClaimedTrophyRewards(userData.claimedTrophyRewards || []);
          setHasClaimedDailyBonus(userData.hasClaimedDailyBonus || false);
          setMissions(userData.missions || [
            { id: 'win_1', desc: '전투 1회 완료', target: 1, current: 0, reward: 50, completed: false },
            { id: 'trophy_10', desc: '트로피 10점 획득', target: 10, current: 0, reward: 100, completed: false },
            { id: 'gacha_1', desc: '카드 1회 뽑기', target: 1, current: 0, reward: 30, completed: false }
          ]);
          setIsLoggedIn(true);
        } else {
          // New user initialization
          userData = {
            uid: user.uid,
            username: user.email?.split('@')[0] || '사령관',
            trophies: 0,
            gold: 500,
            level: 1,
            xp: 0,
            cardLevels: {},
            unlockedCards: defaultCards,
            selectedDeck: [],
            fragments: { common: 0, rare: 0, epic: 0, legendary: 0 },
            missions: [
              { id: 'win1', desc: '전투에서 1회 승리하기', target: 1, current: 0, reward: 200, completed: false },
              { id: 'play5', desc: '유닛 5회 소환하기', target: 5, current: 0, reward: 100, completed: false }
            ],
            updatedAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', user.uid), userData);
          setPlayerName(userData.username);
          setTrophies(userData.trophies);
          setGold(userData.gold);
          setLevel(userData.level);
          setXp(userData.xp);
          setCardLevels(userData.cardLevels);
          setUnlockedCards(userData.unlockedCards);
          setSelectedDeck(userData.selectedDeck);
          setFragments(userData.fragments);
          setMissions(userData.missions);
          setIsLoggedIn(true);
        }
      } else {
        setIsLoggedIn(false);
      }
      setIsAppReady(true);
    });

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('init', (data: { id: string, map: { width: number, height: number }, cards: Record<string, CardDef> }) => {
      setMyId(data.id);
      setMapInfo(data.map);
      setCardsDef(data.cards);
    });

    newSocket.on('userList', (list: any[]) => {
      setOnlineUsers(list);
    });

    newSocket.on('challengeReceived', (challenger: any) => {
      setIncomingChallenge(challenger);
    });

    newSocket.on('challengeDeclined', (data: { name: string }) => {
      setNotification({ message: `${data.name}님이 대전을 거절했습니다.`, color: '#ef4444' });
      setTimeout(() => setNotification(null), 3000);
    });

    newSocket.on('startChallengedGame', (data: { team: 'red' | 'blue' }) => {
      setIncomingChallenge(null);
      newSocket.emit('joinGame', {
        team: data.team,
        name: playerName,
        deck: selectedDeck,
        trophies,
        cardLevels
      });
      setShowLobby(false);
    });

    newSocket.on('syncMatch', (state: MatchState) => {
      setMatchState(state);
      if (state.status === 'PLAYING') {
        setIsSearching(false);
        setShowLobby(false);
      }
    });

    newSocket.on('onlineCount', (count: number) => {
      setOnlineCount(count);
    });

    newSocket.on('notification', (data: { message: string, color: string }) => {
      setNotification(data);
      setTimeout(() => setNotification(null), 3000);
    });

    newSocket.on('emote', (data: { playerId: string, team: 'red' | 'blue', emote: string }) => {
      setEmotes(prev => [...prev, { id: Math.random().toString(), ...data, life: 1.0 }]);
    });

    newSocket.on('matchResult', (data: { result: string, trophyChange: number, goldChange: number }) => {
      setMatchResultInfo(data);

      setTrophies(prevT => {
        const newTrophies = Math.max(0, prevT + data.trophyChange);
        setGold(prevG => {
          const newGold = prevG + data.goldChange;

          // Update XP and Level
          setXp(prevXp => {
            let newXp = prevXp + (data.result === 'win' ? 50 : 20);
            let newLevel = level;
            const xpToNext = level * 100;
            if (newXp >= xpToNext) {
              newXp -= xpToNext;
              newLevel += 1;
              setLevel(newLevel);
              setNotification({ message: `레벨 업! Lv.${newLevel} 달성!`, color: '#facc15' });
            }

            // Update Missions
            setMissions(prevM => {
              const newM = prevM.map(m => {
                if (m.id === 'win_1' && !m.completed) {
                  return { ...m, current: 1, completed: true };
                }
                if (m.id === 'trophy_10' && data.trophyChange > 0 && !m.completed) {
                  const newCurrent = Math.min(m.target, m.current + data.trophyChange);
                  return { ...m, current: newCurrent, completed: newCurrent >= m.target };
                }
                return m;
              });

              // CRITICAL: Only save changed fields to avoid overwriting other data with stale state
              saveToServer({
                trophies: newTrophies,
                gold: newGold,
                level: newLevel,
                xp: newXp,
                missions: newM,
                updatedAt: new Date().toISOString()
              });
              return newM;
            });

            return newXp;
          });

          return newGold;
        });
        return newTrophies;
      });
    });

    newSocket.on('damageText', (data: { x: number, y: number, amount: number, color: string }) => {
      floatingTextsRef.current.push({
        id: Math.random().toString(),
        x: data.x + (Math.random() * 20 - 10),
        y: data.y - 20,
        amount: data.amount,
        color: data.color,
        life: 1.0
      });
    });

    newSocket.on('sync', (data: { players: Record<string, Player>, units: Unit[], projectiles: Projectile[], effects: Effect[], bases: Record<'red' | 'blue', Base>, towers: Tower[], matchState?: MatchState }) => {
      setPlayers(data.players);
      setProjectiles(data.projectiles);
      setEffects(data.effects);
      if (data.bases) setBases(data.bases);
      if (data.towers) setTowers(data.towers);
      if (data.matchState) setMatchState(data.matchState);

      setUnits(prev => {
        const updated = data.units.map(serverUnit => {
          const existing = prev.find(u => u.id === serverUnit.id);
          if (existing) {
            return { ...serverUnit, x: existing.x, y: existing.y, targetX: serverUnit.x, targetY: serverUnit.y };
          }
          return { ...serverUnit, targetX: serverUnit.x, targetY: serverUnit.y };
        });
        unitsRef.current = updated;
        return updated;
      });
    });

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      newSocket.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!socket || !selectedCardId || matchState.status !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const isPortrait = window.innerHeight > window.innerWidth;

    let logicalX, logicalY;

    if (isPortrait) {
      // In portrait, map is rotated 90deg
      // Logical Width (1600) maps to Screen Height
      // Logical Height (900) maps to Screen Width
      const scale = Math.min(window.innerWidth / mapInfo.height, (window.innerHeight - 150) / mapInfo.width);
      const offsetX = (window.innerWidth - mapInfo.height * scale) / 2;
      const offsetY = (window.innerHeight - mapInfo.width * scale) / 2;

      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Reverse the rotation transformation
      // screenX = offsetX + (mapHeight - logicalY) * scale
      // screenY = offsetY + logicalX * scale
      logicalX = (clickY - offsetY) / scale;
      logicalY = mapInfo.height - (clickX - offsetX) / scale;
    } else {
      const scale = Math.min(window.innerWidth / mapInfo.width, (window.innerHeight - 100) / mapInfo.height);
      const offsetX = (window.innerWidth - mapInfo.width * scale) / 2;
      const offsetY = (window.innerHeight - mapInfo.height * scale) / 2 - 20;

      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      logicalX = (clickX - offsetX) / scale;
      logicalY = (clickY - offsetY) / scale;
    }

    const me = players[myId];
    if (!me) return;

    socket.emit('playCard', { cardId: selectedCardId, x: logicalX, y: logicalY });
    setSelectedCardId(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const isPortrait = window.innerHeight > window.innerWidth;

      let scale, offsetX, offsetY;

      if (isPortrait) {
        // Portrait: Rotate map 90 degrees to fit
        scale = Math.min(window.innerWidth / mapInfo.height, (window.innerHeight - 150) / mapInfo.width);
        offsetX = (window.innerWidth - mapInfo.height * scale) / 2;
        offsetY = (window.innerHeight - mapInfo.width * scale) / 2;
      } else {
        scale = Math.min(window.innerWidth / mapInfo.width, (window.innerHeight - 100) / mapInfo.height);
        offsetX = (window.innerWidth - mapInfo.width * scale) / 2;
        offsetY = (window.innerHeight - mapInfo.height * scale) / 2 - 20;
      }

      // Draw Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(offsetX, offsetY);

      if (isPortrait) {
        // Rotate 90 degrees clockwise and translate
        ctx.rotate(Math.PI / 2);
        ctx.translate(0, -mapInfo.height * scale);
      }

      ctx.scale(scale, scale);

      // Draw Map Boundary
      const themeColors = {
        DEFAULT: { bg: '#1e293b', river: '#0ea5e9', bridge: '#475569', grid: 'rgba(30, 41, 59, 0.5)' },
        LAVA: { bg: '#450a0a', river: '#ef4444', bridge: '#1c1917', grid: 'rgba(127, 29, 29, 0.5)' },
        ICE: { bg: '#f0f9ff', river: '#7dd3fc', bridge: '#bae6fd', grid: 'rgba(186, 230, 253, 0.5)' },
        FOREST: { bg: '#064e3b', river: '#10b981', bridge: '#78350f', grid: 'rgba(5, 150, 105, 0.5)' }
      };
      const theme = themeColors[matchState.theme || 'DEFAULT'];

      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, mapInfo.width, mapInfo.height);

      // Draw River
      ctx.fillStyle = theme.river;
      ctx.fillRect(mapInfo.width / 2 - 50, 0, 100, mapInfo.height);

      // Draw Bridges
      ctx.fillStyle = theme.bridge;
      ctx.fillRect(mapInfo.width / 2 - 70, 200, 140, 100);
      ctx.fillRect(mapInfo.width / 2 - 70, 600, 140, 100);

      // Draw Grid Lines
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i < mapInfo.width; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, mapInfo.height); ctx.stroke();
      }
      for (let i = 0; i < mapInfo.height; i += 100) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(mapInfo.width, i); ctx.stroke();
      }

      // Draw Center Dividing Line
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(mapInfo.width / 2, 0);
      ctx.lineTo(mapInfo.width / 2, mapInfo.height);
      ctx.stroke();
      ctx.setLineDash([]);

      const me = players[myId];

      // Draw Placement Zone Highlight (Removed to allow full map deployment)
      /*
      if (me && selectedCardId && matchState.status === 'PLAYING') {
        ctx.fillStyle = me.team === 'red' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)';
        if (me.team === 'red') {
          ctx.fillRect(0, 0, mapInfo.width / 2, mapInfo.height);
        } else {
          ctx.fillRect(mapInfo.width / 2, 0, mapInfo.width / 2, mapInfo.height);
        }
      }
      */

      // Helper to draw freeze effect
      const drawFreeze = (x: number, y: number, r: number) => {
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      // Draw Bases
      (Object.values(bases) as Base[]).forEach(base => {
        ctx.beginPath();
        ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
        ctx.fillStyle = base.team === 'red' ? '#7f1d1d' : '#1e3a8a';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = base.team === 'red' ? '#ef4444' : '#3b82f6';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(base.x, base.y, base.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = base.team === 'red' ? '#fca5a5' : '#93c5fd';
        ctx.fill();

        if (base.freezeTime > 0) drawFreeze(base.x, base.y, base.radius);

        const hpWidth = 120;
        const hpPercent = base.hp / base.maxHp;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(base.x - hpWidth / 2, base.y - base.radius - 25, hpWidth, 10);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(base.x - hpWidth / 2, base.y - base.radius - 25, hpWidth * hpPercent, 10);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(base.x - hpWidth / 2, base.y - base.radius - 25, hpWidth, 10);
      });

      // Draw Towers
      towers.forEach(tower => {
        if (tower.hp <= 0) return;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, tower.radius, 0, Math.PI * 2);
        ctx.fillStyle = tower.team === 'red' ? '#991b1b' : '#1e40af';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = tower.team === 'red' ? '#f87171' : '#60a5fa';
        ctx.stroke();

        if (tower.freezeTime > 0) drawFreeze(tower.x, tower.y, tower.radius);

        const hpWidth = 60;
        const hpPercent = tower.hp / tower.maxHp;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(tower.x - hpWidth / 2, tower.y - tower.radius - 15, hpWidth, 6);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(tower.x - hpWidth / 2, tower.y - tower.radius - 15, hpWidth * hpPercent, 6);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(tower.x - hpWidth / 2, tower.y - tower.radius - 15, hpWidth, 6);
      });

      // Lerp and Draw Units
      unitsRef.current.forEach(u => {
        if (u.targetX !== undefined && u.targetY !== undefined) {
          u.x += (u.targetX - u.x) * 0.3;
          u.y += (u.targetY - u.y) * 0.3;
        }

        const card = cardsDef[u.cardId];
        if (!card) return;

        const size = card.id === 'giant' ? 30 : (card.id === 'assassin' ? 12 : (card.id === 'skeletons' ? 8 : 15));

        ctx.beginPath();
        ctx.arc(u.x, u.y, size, 0, Math.PI * 2);
        ctx.fillStyle = card.color;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = u.team === 'red' ? '#ef4444' : '#3b82f6';
        ctx.stroke();

        if (u.freezeTime > 0) drawFreeze(u.x, u.y, size);
        if (u.rageTime > 0) {
          ctx.beginPath();
          ctx.arc(u.x, u.y, size + 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(217, 70, 239, 0.6)'; // Fuchsia
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Unit HP
        const hpWidth = size * 2;
        const hpPercent = u.hp / u.maxHp;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(u.x - hpWidth / 2, u.y - size - 12, hpWidth, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(u.x - hpWidth / 2, u.y - size - 12, hpWidth * hpPercent, 4);
      });

      // Draw Projectiles
      projectiles.forEach(proj => {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = proj.team === 'red' ? '#ef4444' : '#3b82f6';
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // Draw Effects
      effects.forEach(eff => {
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${eff.color}44`;
        ctx.fill();
        ctx.strokeStyle = eff.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Draw Floating Texts
      floatingTextsRef.current.forEach(ft => {
        const alpha = Math.max(0, Math.min(1, ft.life));
        const hexAlpha = Math.floor(alpha * 255).toString(16).padStart(2, '0');

        ctx.fillStyle = `${ft.color}${hexAlpha}`;
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';

        const text = ft.color === '#22c55e' ? `+${ft.amount}` : `-${ft.amount}`;

        ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
        ctx.lineWidth = 3;
        ctx.strokeText(text, ft.x, ft.y);
        ctx.fillText(text, ft.x, ft.y);

        ft.y -= 1;
        ft.life -= 0.02;
      });
      floatingTextsRef.current = floatingTextsRef.current.filter(ft => ft.life > 0);

      // Draw Emotes
      setEmotes(prev => {
        const next = prev.filter(e => e.life > 0);
        next.forEach(e => {
          const p = players[e.playerId];
          if (!p) return;
          const baseX = e.team === 'red' ? 150 : mapInfo.width - 150;
          const baseY = mapInfo.height / 2 - 120;
          ctx.save();
          ctx.globalAlpha = Math.max(0, e.life);
          ctx.font = '60px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(e.emote, baseX, baseY);
          e.life -= 0.01;
          ctx.restore();
        });
        return next;
      });

      // Draw Mouse Preview if Card Selected
      if (me && selectedCardId && matchState.status === 'PLAYING') {
        const logicalX = (mousePos.current.x - offsetX) / scale;
        const logicalY = (mousePos.current.y - offsetY) / scale;

        const isValid = (me.team === 'red' && logicalX <= mapInfo.width / 2) || (me.team === 'blue' && logicalX >= mapInfo.width / 2);

        ctx.beginPath();
        const card = cardsDef[selectedCardId];
        const previewRadius = card?.type === 'spell' ? card.radius! : (card?.id === 'giant' ? 30 : 15);

        ctx.arc(logicalX, logicalY, previewRadius, 0, Math.PI * 2);
        ctx.fillStyle = isValid ? 'rgba(255, 255, 255, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        ctx.fill();
        ctx.strokeStyle = isValid ? '#ffffff' : '#ef4444';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [mapInfo, bases, towers, projectiles, effects, myId, players, selectedCardId, cardsDef, matchState.status]);

  const toggleCardSelection = (cardId: string) => {
    let newDeck = [...selectedDeck];
    if (selectedDeck.includes(cardId)) {
      newDeck = selectedDeck.filter(id => id !== cardId);
    } else if (selectedDeck.length < 6) {
      newDeck = [...selectedDeck, cardId];
    }
    setSelectedDeck(newDeck);
    saveToServer({ selectedDeck: newDeck });
  };

  const handleJoinGame = () => {
    if (!socket || selectedDeck.length !== 6) return;
    updateMission('win', 1);
    socket.emit('joinQueue', {
      name: playerName,
      deck: selectedDeck,
      trophies,
      cardLevels
    });
  };

  const handleReturnToLobby = () => {
    if (socket) {
      socket.emit('leaveGame');
      setShowLobby(true);
      setMatchResultInfo(null);
    }
  };

  const me = players[myId];

  const getCardIcon = (cardId: string) => {
    switch (cardId) {
      case 'knight': return <Shield size={24} className="text-slate-900" />;
      case 'archer': return <Target size={24} className="text-slate-900" />;
      case 'giant': return <Swords size={24} className="text-slate-900" />;
      case 'assassin': return <Crosshair size={24} className="text-slate-900" />;
      case 'valkyrie': return <Swords size={24} className="text-slate-900" />;
      case 'sniper': return <Target size={24} className="text-slate-900" />;
      case 'skeletons': return <Skull size={24} className="text-slate-900" />;
      case 'fireball': return <Flame size={24} className="text-slate-900" />;
      case 'heal': return <Plus size={24} className="text-slate-900" />;
      case 'freeze': return <Snowflake size={24} className="text-slate-900" />;
      case 'rage': return <Flame size={24} className="text-slate-900" />;
      case 'lightning': return <Zap size={24} className="text-slate-900" />;
      case 'dragon': return <Flame size={24} className="text-slate-900" />;
      case 'pekka': return <Shield size={24} className="text-slate-900" />;
      case 'arrows': return <Target size={24} className="text-slate-900" />;
      case 'dark_knight': return <Swords size={24} className="text-slate-900" />;
      case 'ice_golem': return <Snowflake size={24} className="text-slate-900" />;
      case 'poison': return <Droplets size={24} className="text-slate-900" />;
      case 'healer': return <Heart size={24} className="text-slate-900" />;
      case 'vampire': return <Skull size={24} className="text-slate-900" />;
      case 'mini_pekka': return <Shield size={24} className="text-slate-900" />;
      case 'barbarians': return <Users size={24} className="text-slate-900" />;
      case 'witch': return <Zap size={24} className="text-slate-900" />;
      case 'ice_spirit': return <Snowflake size={24} className="text-slate-900" />;
      case 'fire_spirit': return <Flame size={24} className="text-slate-900" />;
      case 'bandit': return <Crosshair size={24} className="text-slate-900" />;
      case 'giant_skeleton': return <Skull size={24} className="text-slate-900" />;
      case 'goblins': return <Users size={24} className="text-slate-900" />;
      case 'princess': return <Target size={24} className="text-slate-900" />;
      case 'royal_giant': return <Swords size={24} className="text-slate-900" />;
      case 'miner': return <Home size={24} className="text-slate-900" />;
      case 'rocket': return <Zap size={24} className="text-slate-900" />;
      case 'executioner': return <Swords size={24} className="text-slate-900" />;
      case 'balloon': return <Skull size={24} className="text-slate-900" />;
      case 'electro_spirit': return <Zap size={24} className="text-blue-900" />;
      case 'night_witch': return <Skull size={24} className="text-purple-900" />;
      case 'inferno_dragon': return <Flame size={24} className="text-green-900" />;
      case 'zap': return <Zap size={24} className="text-sky-400" />;
      case 'tornado': return <Loader2 size={24} className="text-slate-400" />;
      case 'ram_rider': return <Swords size={24} className="text-indigo-900" />;
      case 'magic_archer': return <Target size={24} className="text-orange-900" />;
      case 'ice_wizard': return <Snowflake size={24} className="text-blue-300" />;
      default: return <Swords size={24} className="text-slate-900" />;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      // Allow username by appending domain if not present
      const email = username.includes('@') ? username : `${username}@clash.app`;
      if (authMode === 'LOGIN') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('이미 사용 중인 아이디(이메일)입니다.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('비밀번호는 6자리 이상이어야 합니다.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('올바른 이메일 형식이 아닙니다.');
      } else {
        setAuthError('인증 오류가 발생했습니다.');
      }
    }
  };

  if (!isAppReady) {
    return (
      <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-white">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">시스템 초기화 중...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-white">
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-md">
          <h1 className="text-4xl font-black text-center mb-8 tracking-tight text-blue-500">CLASH</h1>
          <div className="flex mb-6">
            <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3 font-bold transition-colors ${authMode === 'LOGIN' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>로그인</button>
            <button onClick={() => setAuthMode('REGISTER')} className={`flex-1 py-3 font-bold transition-colors ${authMode === 'REGISTER' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>회원가입</button>
          </div>
          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <input type="text" placeholder="아이디 (또는 이메일)" value={username} onChange={e => setUsername(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" required />
            <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" required />
            {authError && <p className={`text-sm ${authError.includes('성공') ? 'text-green-400' : 'text-red-400'}`}>{authError}</p>}
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mt-2 transition-colors">
              {authMode === 'LOGIN' ? '로그인' : '회원가입'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
      />

      {/* Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 50, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
          >
            <div
              className="px-8 py-4 rounded-2xl shadow-2xl border-2 font-black text-2xl tracking-widest"
              style={{ backgroundColor: notification.color + '22', borderColor: notification.color, color: notification.color }}
            >
              {notification.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {matchState.isDoubleMana && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-400 px-4 py-1 rounded-full border border-yellow-500/50 font-bold text-sm animate-pulse z-40">
          ELIXIR x2
        </div>
      )}

      {/* Pause Button (Only during play) */}
      {matchState.status === 'PLAYING' && (
        <button
          onClick={() => socket?.emit('togglePause')}
          className="absolute top-4 right-4 z-50 bg-slate-900/80 hover:bg-slate-800 text-white p-3 rounded-full border border-slate-700 shadow-xl transition-all active:scale-95"
          title={matchState.isPaused ? "재개" : "일시정지"}
        >
          {matchState.isPaused ? (
            <div className="w-6 h-6 flex items-center justify-center">▶️</div>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center">⏸️</div>
          )}
        </button>
      )}

      {/* Pause Overlay */}
      <AnimatePresence>
        {matchState.isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-[45] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-slate-900 p-12 rounded-[3rem] border-4 border-slate-800 shadow-[0_0_100px_rgba(30,58,138,0.3)] flex flex-col items-center"
            >
              <div className="text-6xl mb-6">⏸️</div>
              <h2 className="text-5xl font-black text-white mb-2 tracking-tighter">GAME PAUSED</h2>
              <p className="text-slate-400 mb-10 font-medium">일시정지 중입니다...</p>
              <button
                onClick={() => socket?.emit('togglePause')}
                className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black text-xl shadow-lg transition-all active:scale-90 flex items-center gap-3"
              >
                <span>계속하기</span>
                <span>▶️</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emote Buttons */}
      {matchState.status === 'PLAYING' && (
        <div className="absolute bottom-32 left-4 flex flex-col items-start gap-2 z-40">
          <AnimatePresence>
            {showEmoteMenu && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-2 mb-2"
              >
                {['😀', '😭', '😠', '👍', '🔥', '👑'].map(e => (
                  <button
                    key={e}
                    onClick={() => {
                      socket?.emit('sendEmote', e);
                      setShowEmoteMenu(false);
                    }}
                    className="w-12 h-12 bg-slate-800/90 hover:bg-slate-700 rounded-full flex items-center justify-center text-2xl transition-transform hover:scale-110 border border-slate-600 shadow-lg"
                  >
                    {e}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setShowEmoteMenu(!showEmoteMenu)}
            className="w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-2xl shadow-xl border-2 border-white/20 transition-transform active:scale-90"
          >
            <Smile className="text-white" size={28} />
          </button>
        </div>
      )}
      {showLobby && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-md z-50 overflow-y-auto p-4 sm:p-10">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col h-[90vh] sm:h-[80vh]">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 sm:p-6 border-b border-slate-800 gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center font-black text-slate-900 text-lg shadow-lg border-2 border-white/20">
                    {level}
                  </div>
                  <div className="flex flex-col">
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">{playerName}</h1>
                    <div className="w-24 sm:w-32 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mt-1">
                      <div
                        className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                        style={{ width: `${Math.min(100, (xp / (level * 100)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-4 items-center">
                <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-yellow-500/50">
                  <span className="text-yellow-400 font-bold text-sm sm:text-base">💰 {gold}</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-blue-500/50">
                  <Trophy className="text-blue-400" size={16} />
                  <span className="text-blue-400 font-bold text-sm sm:text-base">{trophies}</span>
                </div>
                <button
                  onClick={() => signOut(auth)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold transition-colors border border-slate-600 text-sm"
                >
                  로그아웃
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 overflow-x-auto no-scrollbar">
              {[
                { id: 'BATTLE', label: '전투', color: 'border-blue-500' },
                { id: 'DECK', label: '덱', color: 'border-blue-500' },
                { id: 'SHOP', label: '상점', color: 'border-yellow-500' },
                { id: 'SYNTHESIS', label: '합성', color: 'border-purple-500' },
                { id: 'PACHINKO', label: '빠칭코', color: 'border-green-500' },
                { id: 'USERS', label: '랭킹 & 유저', color: 'border-slate-500' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setGachaResult(null); setPachinkoResult(null); }}
                  className={`flex-1 min-w-[80px] py-4 font-bold text-sm sm:text-lg transition-colors whitespace-nowrap ${activeTab === tab.id ? `bg-slate-800 text-white border-b-2 ${tab.color}` : 'text-slate-400 hover:bg-slate-800/50'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">

              {activeTab === 'BATTLE' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                    {/* Battle Section */}
                    <div className="lg:col-span-2 flex flex-col items-center space-y-8 bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50">
                      <div className="w-full">
                        <h3 className="text-slate-400 font-black mb-6 text-center uppercase tracking-widest">현재 전투 덱 ({selectedDeck.length}/6)</h3>
                        <div className="flex flex-wrap justify-center gap-4">
                          {selectedDeck.map(id => {
                            const card = cardsDef[id];
                            if (!card) return null;
                            const level = cardLevels[id] || 1;
                            return (
                              <div key={id} className="relative flex flex-col items-center p-4 rounded-2xl border-2 border-blue-500 bg-slate-800 shadow-lg transform transition-transform hover:scale-105">
                                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2 shadow-inner" style={{ backgroundColor: card.color }}>
                                  {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 24 })}
                                </div>
                                <span className="text-white text-sm font-black">{card.name}</span>
                                <div className="absolute -top-3 -right-3 bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white border-2 border-slate-900 shadow-lg">
                                  {card.cost}
                                </div>
                                <div className="absolute -bottom-2 bg-yellow-500 px-3 py-0.5 rounded-full text-[10px] font-black text-slate-900 shadow-md">
                                  Lv.{level}
                                </div>
                              </div>
                            );
                          })}
                          {selectedDeck.length === 0 && (
                            <div className="text-slate-500 font-bold py-10">덱이 비어있습니다. [덱] 탭에서 카드를 선택하세요!</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-center space-y-6 w-full pt-8 border-t border-slate-800">
                        <button
                          onClick={handleJoinGame}
                          disabled={isSearching || selectedDeck.length !== 6}
                          className={`group relative px-20 py-8 rounded-3xl font-black text-4xl transition-all transform hover:scale-105 active:scale-95 shadow-2xl
                            ${isSearching || selectedDeck.length !== 6
                              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                              : 'bg-gradient-to-br from-blue-600 to-blue-400 text-white hover:shadow-[0_0_50px_rgba(59,130,246,0.5)]'
                            }
                          `}
                        >
                          {isSearching ? (
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>매칭 중...</span>
                            </div>
                          ) : '전투 시작'}
                        </button>
                        <p className="text-slate-500 font-bold">AI와 대결하여 트로피와 골드를 획득하세요!</p>
                      </div>
                    </div>

                    {/* Right Column: Missions & Trophy Rewards */}
                    <div className="flex flex-col space-y-4">
                      {/* Missions Section */}
                      <div className="flex flex-col space-y-4 bg-slate-800/30 p-6 rounded-3xl border border-slate-700/50">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                          <Trophy size={20} className="text-yellow-400" />
                          오늘의 미션
                        </h3>
                        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                          {missions.map(m => (
                            <div key={m.id} className={`p-4 rounded-2xl border transition-all ${m.completed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <span className={`font-bold text-sm ${m.completed ? 'text-green-400' : 'text-slate-300'}`}>{m.desc}</span>
                                {m.completed && (
                                  <button
                                    onClick={() => {
                                      setGold(g => g + m.reward);
                                      setMissions(prev => prev.filter(mission => mission.id !== m.id));
                                      setNotification({ message: `보상 획득! +${m.reward} 골드`, color: '#22c55e' });
                                    }}
                                    className="bg-green-500 text-slate-950 text-[10px] font-black px-2 py-1 rounded-lg hover:bg-green-400 shadow-lg"
                                  >
                                    보상 받기
                                  </button>
                                )}
                              </div>
                              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${m.completed ? 'bg-green-500' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                                  style={{ width: `${(m.current / m.target) * 100}%` }}
                                />
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-slate-500 font-bold">{m.current} / {m.target}</span>
                                <span className="text-[10px] text-yellow-500 font-bold">{m.reward} Gold</span>
                              </div>
                            </div>
                          ))}
                          {missions.length === 0 && (
                            <div className="text-center py-10 text-slate-500 font-bold italic">모든 미션을 완료했습니다!</div>
                          )}
                          {missions.length > 0 && missions.every(m => m.completed) && (
                            <div className="mt-4 p-4 bg-yellow-500/20 border-2 border-yellow-500 rounded-2xl flex flex-col items-center gap-3">
                              <span className="text-yellow-400 font-black text-center">🎉 모든 오늘의 미션 완료! 🎉</span>
                              <button
                                onClick={() => {
                                  const bonusReward = 500;
                                  setGold(g => g + bonusReward);
                                  setMissions([]);
                                  setHasClaimedDailyBonus(true);
                                  saveToServer({ gold: gold + bonusReward, missions: [], hasClaimedDailyBonus: true });
                                  setNotification({ message: `최종 보상 획득! +${bonusReward} 골드`, color: '#facc15' });
                                }}
                                className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-2 rounded-xl shadow-lg transition-transform active:scale-95"
                              >
                                최종 보상 받기 (500G)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Trophy Road Section */}
                      <div className="flex flex-col space-y-4 bg-slate-800/30 p-6 rounded-3xl border border-slate-700/50">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                          <Trophy size={20} className="text-blue-400" />
                          트로피 보상 (Trophy Road)
                        </h3>
                        <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                          {trophyMilestones.map(m => {
                            const isClaimed = claimedTrophyRewards.includes(m.trophies);
                            const canClaim = trophies >= m.trophies && !isClaimed;
                            return (
                              <div key={m.trophies} className={`p-4 rounded-2xl border flex justify-between items-center ${isClaimed ? 'bg-slate-800/20 border-slate-800 opacity-50' : canClaim ? 'bg-blue-500/10 border-blue-500' : 'bg-slate-900 border-slate-700'}`}>
                                <div className="flex flex-col">
                                  <span className="text-white font-bold text-sm">{m.trophies} 트로피 달성</span>
                                  <span className="text-yellow-500 text-xs font-black">{m.label}</span>
                                </div>
                                {isClaimed ? (
                                  <span className="text-slate-500 text-xs font-bold">수령 완료</span>
                                ) : (
                                  <button
                                    onClick={() => claimTrophyReward(m.trophies, m.reward)}
                                    disabled={!canClaim}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${canClaim ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                                  >
                                    {canClaim ? '보상 받기' : '잠김'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'DECK' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-3xl font-black text-white">카드 보관함</h2>
                      <p className="text-slate-500 text-sm">전투에 사용할 6개의 카드를 선택하세요.</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`px-5 py-2 rounded-2xl text-base font-black border-2 flex items-center gap-3 shadow-lg ${selectedDeck.length === 6 ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-red-500/10 border-red-500 text-red-400'}`}>
                        <Swords size={20} />
                        <span>전투 덱 {selectedDeck.length} / 6</span>
                      </div>
                      <p className="text-slate-500 text-[10px] mt-1 font-bold">6개의 카드를 선택해야 전투를 시작할 수 있습니다.</p>
                    </div>
                  </div>

                  {['legendary', 'epic', 'rare', 'common'].map(rarity => {
                    const cardsOfRarity = (Object.values(CARDS) as CardDef[]).filter(c => c.rarity === rarity);
                    if (cardsOfRarity.length === 0) return null;

                    let rarityColorText = 'text-slate-400';
                    if (rarity === 'rare') rarityColorText = 'text-blue-400';
                    if (rarity === 'epic') rarityColorText = 'text-purple-500';
                    if (rarity === 'legendary') rarityColorText = 'text-yellow-400';

                    return (
                      <div key={rarity} className="mb-6">
                        <h3 className={`text-sm font-black uppercase mb-2 ${rarityColorText}`}>{rarity}</h3>
                        <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-3">
                          {cardsOfRarity.map(card => {
                            const isUnlocked = unlockedCards.includes(card.id);
                            const isSelected = selectedDeck.includes(card.id);
                            const level = cardLevels[card.id] || 1;
                            const upgradeCost = level * 50;

                            let rarityColor = 'border-slate-500';
                            if (card.rarity === 'rare') rarityColor = 'border-blue-400';
                            if (card.rarity === 'epic') rarityColor = 'border-purple-500';
                            if (card.rarity === 'legendary') rarityColor = 'border-yellow-400';

                            return (
                              <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative flex flex-col items-center p-2 rounded-2xl border-2 transition-all cursor-pointer group ${!isUnlocked
                                  ? 'opacity-40 grayscale border-slate-800 bg-slate-900/50'
                                  : isSelected
                                    ? `bg-slate-800 ${rarityColor} shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-2 ring-blue-500/50 scale-105 z-10`
                                    : `bg-slate-900 ${rarityColor} hover:bg-slate-800 hover:scale-105`
                                  }`}
                                onClick={() => isUnlocked && toggleCardSelection(card.id)}
                              >
                                {isSelected && (
                                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full z-20 shadow-xl border-2 border-slate-900 flex items-center gap-1">
                                    <Target size={12} />
                                    <span>선택됨</span>
                                  </div>
                                )}

                                <div className="w-full flex flex-col items-center">
                                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-2 shadow-2xl relative" style={{ backgroundColor: card.color }}>
                                    {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 32 })}
                                    {isSelected && (
                                      <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1 shadow-lg border-2 border-slate-900">
                                        <Plus size={10} className="rotate-45" />
                                      </div>
                                    )}
                                  </div>

                                  <span className="text-white text-xs sm:text-sm font-black mb-1 truncate w-full text-center px-1">
                                    {card.name}
                                  </span>

                                  <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-blue-400 border border-slate-700 shadow-lg">
                                    {card.cost}
                                  </div>

                                  {isUnlocked && (
                                    <div className="mt-1 bg-yellow-500 px-3 py-0.5 rounded-full text-[10px] font-black text-slate-900 shadow-sm">
                                      Lv.{level}
                                    </div>
                                  )}

                                  {isUnlocked && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (gold >= upgradeCost) {
                                          const newL = { ...cardLevels, [card.id]: level + 1 };
                                          setCardLevels(newL);
                                          setGold(g => {
                                            const newG = g - upgradeCost;
                                            saveToServer({ gold: newG, cardLevels: newL });
                                            return newG;
                                          });
                                        }
                                      }}
                                      disabled={gold < upgradeCost}
                                      className={`mt-2 w-full py-1 rounded-lg text-[10px] font-black transition-colors ${gold >= upgradeCost ? 'bg-green-600 text-white hover:bg-green-500 shadow-sm' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                    >
                                      강화 {upgradeCost}G
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'SHOP' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
                  {/* Gacha Section */}
                  <div className="bg-slate-800/30 p-10 rounded-[3rem] border border-slate-700/50 flex flex-col items-center text-center w-full shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -z-10" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 blur-[100px] -z-10" />
                    
                    <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">카드 소환</h2>
                    <p className="text-slate-400 mb-10 max-w-md">강력한 전설 카드를 획득하여 당신의 덱을 무적의 군단으로 만드세요!</p>
                    
                    <div className="relative mb-12">
                      <motion.div 
                        animate={{ y: [0, -15, 0] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        className="relative z-10"
                      >
                        <div className="w-48 h-48 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2.5rem] border-4 border-slate-700/50 flex items-center justify-center text-8xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          🎁
                        </div>
                      </motion.div>
                      <div className="absolute -inset-10 bg-blue-500/10 blur-[60px] rounded-full -z-10 animate-pulse" />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
                      <button
                        onClick={() => handleGacha(1)}
                        disabled={gold < 100}
                        className={`flex-1 group relative px-8 py-6 rounded-[2rem] font-black text-2xl transition-all active:scale-95 shadow-xl border-2
                          ${gold >= 100 ? 'bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-700 text-white' : 'bg-slate-900 border-slate-800 text-slate-600 disabled:opacity-50'}
                        `}
                      >
                        <div className="flex flex-col items-center">
                          <span>1회 소환</span>
                          <div className="flex items-center gap-2 text-yellow-500 text-sm mt-2 bg-slate-950/50 px-3 py-1 rounded-full">
                            <Coins size={16} /> 100
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => handleGacha(10)}
                        disabled={gold < 900}
                        className={`flex-1 group relative px-8 py-6 rounded-[2rem] font-black text-2xl transition-all active:scale-95 shadow-2xl border-2
                          ${gold >= 900 ? 'bg-gradient-to-br from-blue-600 to-blue-500 border-blue-400 text-white hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]' : 'bg-slate-900 border-slate-800 text-slate-600 disabled:opacity-50'}
                        `}
                      >
                        <div className="flex flex-col items-center">
                          <span>10회 소환</span>
                          <div className="flex items-center gap-2 text-white/90 text-sm mt-2 bg-blue-950/50 px-3 py-1 rounded-full font-bold">
                            <Coins size={16} /> 900G
                          </div>
                        </div>
                        <div className="absolute -top-4 -right-4 bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-2xl shadow-lg border-2 border-slate-900 ring-4 ring-red-500/20">10% 할 인</div>
                      </button>
                    </div>

                    <AnimatePresence>
                      {gachaResult && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 30 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 30 }}
                          className="mt-12 p-8 bg-slate-950/80 backdrop-blur-xl rounded-[2.5rem] border border-slate-700 w-full shadow-inner"
                        >
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest text-left">소환 결과</h3>
                            <button onClick={() => setGachaResult(null)} className="text-slate-500 hover:text-white transition-colors">
                              <Plus size={24} className="rotate-45" />
                            </button>
                          </div>
                          
                          <div className="flex flex-wrap justify-center gap-6 max-h-[250px] overflow-y-auto p-4 custom-scrollbar">
                            {Array.isArray(gachaResult) ? (
                              gachaResult.map((res: any, i: number) => {
                                const card = CARDS[res.cardId];
                                return (
                                  <motion.div 
                                    key={i} 
                                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.05 }}
                                    className="flex flex-col items-center group/card"
                                  >
                                    <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 flex items-center justify-center bg-slate-900 relative transition-all group-hover/card:scale-110 ${res.isNew ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] bg-yellow-500/5' : 'border-slate-800'}`}>
                                      {React.cloneElement(getCardIcon(res.cardId) as React.ReactElement, { size: 32 })}
                                      {res.isNew && <div className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-slate-900 text-[8px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-slate-950">NEW</div>}
                                    </div>
                                    <span className="text-[10px] mt-2 font-black text-slate-400 group-hover/card:text-white transition-colors uppercase">{card?.name}</span>
                                  </motion.div>
                                );
                              })
                            ) : (
                              <div className="flex flex-col items-center py-4">
                                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                                  <div className={`w-28 h-28 rounded-3xl border-4 flex items-center justify-center bg-slate-900 relative ${gachaResult.isNew ? 'border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.4)]' : 'border-slate-800'}`}>
                                    {React.cloneElement(getCardIcon(gachaResult.cardId) as React.ReactElement, { size: 56 })}
                                  </div>
                                </motion.div>
                                <h4 className="text-3xl font-black text-white mt-6 tracking-tight">{CARDS[gachaResult.cardId]?.name}</h4>
                                <div className="mt-2 px-4 py-1.5 bg-yellow-500 rounded-full text-xs font-black text-slate-900 shadow-lg animate-pulse">
                                  {gachaResult.isNew ? '✨ 새로운 카드 획득! ✨' : '카드 조각 +1 획득'}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Daily Shop Section */}
                  <div className="bg-slate-800/30 p-10 rounded-[3rem] border border-slate-700/50 shadow-xl">
                    <div className="flex justify-between items-center mb-8">
                      <div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-3">
                          <Coins className="text-yellow-400" size={32} />
                          데일리 상점
                        </h2>
                        <p className="text-slate-500 text-sm mt-1 font-bold italic">매일 새로운 카드가 당신을 기다립니다!</p>
                      </div>
                      <button
                        onClick={refreshShop}
                        className="bg-slate-900 hover:bg-slate-800 text-blue-400 px-6 py-3 rounded-2xl text-sm font-black border border-slate-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg group"
                      >
                        <Loader2 size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                        새로고침 (-50G)
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {shopCards.map(id => {
                        const card = CARDS[id];
                        if (!card) return null;
                        const isUnlocked = unlockedCards.includes(id);
                        const price = card.rarity === 'legendary' ? 2000 : card.rarity === 'epic' ? 1000 : card.rarity === 'rare' ? 500 : 200;

                        return (
                          <div key={id} className={`group bg-slate-900/40 p-6 rounded-[2rem] border transition-all flex flex-col items-center text-center ${isUnlocked ? 'border-slate-800 opacity-60' : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/60 shadow-lg'}`}>
                            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-2xl relative" style={{ backgroundColor: card.color + '22' }}>
                              <div className="absolute inset-0 rounded-2xl border-2 border-white/5" />
                              {React.cloneElement(getCardIcon(id) as React.ReactElement, { size: 40 })}
                            </div>
                            <div className="mb-6">
                              <div className="text-white text-xl font-black tracking-tight">{card.name}</div>
                              <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 px-3 py-1 bg-slate-950/50 rounded-full inline-block">{card.rarity}</div>
                            </div>
                            <button
                              onClick={() => {
                                if (gold >= price && !isUnlocked) {
                                  const newGold = gold - price;
                                  setGold(newGold);
                                  setUnlockedCards(prev => {
                                    const newU = [...prev, id];
                                    saveToServer({ gold: newGold, unlockedCards: newU });
                                    return newU;
                                  });
                                  setNotification({ message: `${card.name} 카드를 구매했습니다!`, color: '#22c55e' });
                                }
                              }}
                              disabled={gold < price || isUnlocked}
                              className={`w-full py-4 rounded-2xl font-black text-sm transition-all shadow-md ${isUnlocked ? 'bg-slate-950 text-slate-600' : gold >= price ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20' : 'bg-slate-800 text-slate-500'}`}
                            >
                              {isUnlocked ? '보유 중' : `${price} G`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'SYNTHESIS' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
                  <div className="text-center">
                    <h2 className="text-4xl font-black text-purple-400 mb-2">카드 강화 센터</h2>
                    <p className="text-slate-400">조각을 사용하여 보유한 무작위 카드의 레벨을 올리세요!</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { rarity: 'common', name: '일반', cost: 20, color: 'text-slate-300', border: 'border-slate-700', btn: 'bg-slate-700' },
                      { rarity: 'rare', name: '희귀', cost: 10, color: 'text-orange-400', border: 'border-orange-900', btn: 'bg-orange-600' },
                      { rarity: 'epic', name: '영웅', cost: 5, color: 'text-purple-400', border: 'border-purple-900', btn: 'bg-purple-600' },
                      { rarity: 'legendary', name: '전설', cost: 2, color: 'text-yellow-400', border: 'border-yellow-900', btn: 'bg-yellow-600' }
                    ].map(type => (
                      <div key={type.rarity} className={`bg-slate-800/50 p-6 rounded-3xl border ${type.border} flex flex-col items-center shadow-xl backdrop-blur-sm`}>
                        <h3 className={`text-xl font-black mb-2 ${type.color}`}>{type.name} 조각</h3>
                        <div className={`text-3xl font-black mb-6 ${type.color}`}>
                          {fragments[type.rarity] || 0} <span className="text-lg text-slate-500">/ {type.cost}</span>
                        </div>
                        <button
                          onClick={() => {
                            const myPool = unlockedCards.filter(id => CARDS[id] && CARDS[id].rarity === type.rarity);
                            if (myPool.length === 0) {
                              setNotification({ message: `${type.name} 등급의 카드를 먼저 획득해야 합니다.`, color: "#ef4444" });
                              return;
                            }
                            const newFragments = { ...fragments, [type.rarity]: (fragments[type.rarity] || 0) - type.cost };
                            const targetId = myPool[Math.floor(Math.random() * myPool.length)];
                            const targetCard = CARDS[targetId];
                            const newLevels = { ...cardLevels, [targetId]: (cardLevels[targetId] || 1) + 1 };
                            setCardLevels(newLevels);
                            setFragments(newFragments);
                            setNotification({ message: `✨ ${targetCard.name} 강화! (Lv.${newLevels[targetId]}) ✨`, color: targetCard.color });
                            saveToServer({ trophies, gold, cardLevels: newLevels, unlockedCards, selectedDeck, fragments: newFragments });
                          }}
                          disabled={(fragments[type.rarity] || 0) < type.cost}
                          className={`w-full py-4 rounded-2xl font-black transition-all transform active:scale-95 shadow-lg ${(fragments[type.rarity] || 0) >= type.cost ? `${type.btn} text-white hover:brightness-110` : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                          강화하기
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'PACHINKO' && (
                <div className="flex-1 overflow-y-auto p-8 space-y-8 flex flex-col items-center">
                  <div className="text-center">
                    <h2 className="text-4xl font-black text-green-400 mb-2">대박 빠칭코</h2>
                    <p className="text-slate-400">100 골드로 대박을 노려보세요!</p>
                  </div>

                  <div className="relative w-64 h-64 bg-slate-800 rounded-full border-8 border-slate-700 flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                    <motion.div
                      animate={isSpinning ? { rotate: 360 * 5 } : { rotate: 0 }}
                      transition={isSpinning ? { duration: 2, ease: "easeInOut" } : { duration: 0 }}
                      className="text-6xl"
                    >
                      {isSpinning ? '🎰' : (pachinkoResult ? (pachinkoResult.amount > 500 ? '💎' : '💰') : '❓')}
                    </motion.div>
                  </div>

                  <button
                    onClick={() => {
                      if (gold >= 100 && !isSpinning) {
                        setGold(prev => prev - 100);
                        setIsSpinning(true);
                        setPachinkoResult(null);
                        setTimeout(() => {
                          setIsSpinning(false);
                          const rand = Math.random();
                          let result: { amount: number, type: 'gold' | 'fragments' };
                          if (rand < 0.05) result = { amount: 2000, type: 'gold' }; // Jackpot
                          else if (rand < 0.2) result = { amount: 500, type: 'gold' };
                          else if (rand < 0.5) result = { amount: 150, type: 'gold' };
                          else result = { amount: 20, type: 'gold' }; // Loss-ish

                          setPachinkoResult(result);
                          setGold(prev => {
                            const newGold = prev + result.amount;
                            saveToServer({ trophies, gold: newGold, cardLevels, unlockedCards, selectedDeck, fragments });
                            return newGold;
                          });
                        }, 2000);
                      }
                    }}
                    disabled={gold < 100 || isSpinning}
                    className={`px-12 py-4 rounded-2xl font-black text-2xl transition-all transform hover:scale-105 active:scale-95 ${gold >= 100 && !isSpinning ? 'bg-green-500 text-slate-950 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                  >
                    {isSpinning ? '회전 중...' : '100 골드로 돌리기'}
                  </button>

                  {pachinkoResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center p-6 bg-slate-800 rounded-2xl border-2 border-green-500"
                    >
                      <div className="text-slate-400 font-bold mb-1">결과</div>
                      <div className="text-3xl font-black text-green-400">+{pachinkoResult.amount} 골드</div>
                    </motion.div>
                  )}
                </div>
              )}

              {activeTab === 'USERS' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Online Users */}
                    <div>
                      <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                        <Users className="text-green-400" size={24} />
                        접속 중인 유저 ({onlineUsers.length})
                      </h2>
                      <div className="flex flex-col gap-4">
                        {onlineUsers.length > 0 ? onlineUsers.map(user => (
                          <div key={user.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-white font-bold">{user.name} {user.id === myId && '(나)'}</span>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Trophy size={12} />
                                <span>{user.trophies}</span>
                                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${user.status === 'PLAYING' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                  {user.status === 'PLAYING' ? '전투 중' : '대기 중'}
                                </span>
                              </div>
                            </div>
                            {user.id !== myId && user.status === 'LOBBY' && (
                              <button
                                onClick={() => {
                                  socket?.emit('challengePlayer', user.id);
                                  setNotification({ message: `${user.name}님에게 대전을 신청했습니다.`, color: '#3b82f6' });
                                  setTimeout(() => setNotification(null), 3000);
                                }}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all"
                              >
                                대전 신청
                              </button>
                            )}
                          </div>
                        )) : (
                          <div className="text-slate-500 italic text-sm">현재 접속 중인 다른 유저가 없습니다.</div>
                        )}
                      </div>
                    </div>

                    {/* Leaderboard */}
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black text-white flex items-center gap-2">
                          <Trophy className="text-yellow-400" size={24} />
                          전체 랭킹 (TOP 20)
                        </h2>
                        <button
                          onClick={fetchLeaderboard}
                          className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                          disabled={isFetchingLeaderboard}
                        >
                          {isFetchingLeaderboard ? '갱신 중...' : '새로고침'}
                        </button>
                      </div>
                      <div className="flex flex-col gap-3">
                        {leaderboard.map((user, index) => (
                          <div key={user.id} className={`p-4 rounded-2xl border flex justify-between items-center ${auth.currentUser?.uid === user.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900/50 border-slate-800'}`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-yellow-400 text-slate-900' : index === 1 ? 'bg-slate-300 text-slate-900' : index === 2 ? 'bg-orange-400 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>
                                {index + 1}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-white font-bold">{user.username} {auth.currentUser?.uid === user.id && '(나)'}</span>
                                <span className="text-[10px] text-slate-500">Lv.{user.level || 1}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-yellow-500 font-black">
                              <Trophy size={16} />
                              <span>{user.trophies}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* HUD Overlay */}
      {!showLobby && me && matchState.status === 'PLAYING' && (
        <>
          {/* Opponent Info */}
          {(() => {
            const opponent = Object.values(players).find((p: any) => p.id !== myId) as any;
            if (!opponent) return null;
            return (
              <div className="absolute top-4 right-4 flex flex-col items-end pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex flex-col items-end">
                  <span className="text-red-400 font-bold text-[10px] sm:text-sm mb-1 sm:mb-2">적 사령관: {opponent.name}</span>
                  <div className="flex gap-1 sm:gap-2">
                    {opponent.deck.map((id: string) => {
                      const card = cardsDef[id];
                      if (!card) return null;
                      return (
                        <div key={id} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border border-slate-600" style={{ backgroundColor: card.color }}>
                          {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 12 })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Top Info (Removed Timer) */}

          {/* Bottom Card Deck & Mana */}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-950 to-transparent pt-10 sm:pt-20 pb-4 sm:pb-6 px-4 sm:px-6 flex flex-col items-center pointer-events-none z-30">

            {/* Cards */}
            <div className="flex gap-1.5 sm:gap-4 mb-3 sm:mb-6 pointer-events-auto overflow-x-auto no-scrollbar max-w-full px-2">
              {me.deck.map(cardId => {
                const card = cardsDef[cardId];
                if (!card) return null;
                const canAfford = me.mana >= card.cost;
                const isSelected = selectedCardId === card.id;

                return (
                  <button
                    key={card.id}
                    onClick={() => canAfford && setSelectedCardId(isSelected ? null : card.id)}
                    disabled={!canAfford}
                    className={`relative w-16 h-22 sm:w-24 sm:h-32 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-between p-1 sm:p-2 bg-slate-800 flex-shrink-0
                      ${!canAfford ? 'opacity-50 grayscale cursor-not-allowed border-slate-700' : 'hover:-translate-y-2 cursor-pointer'}
                      ${isSelected ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] -translate-y-4' : 'border-slate-600'}
                    `}
                  >
                    <div className="absolute -top-2 -left-2 sm:-top-3 sm:-left-3 w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center font-black text-white shadow-lg z-10 text-[8px] sm:text-xs">
                      {card.cost}
                    </div>

                    <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mt-0.5 sm:mt-2" style={{ backgroundColor: card.color }}>
                      {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 14 })}
                    </div>

                    <div className="text-center">
                      <div className="text-white font-bold text-[8px] sm:text-xs truncate w-full">{card.name}</div>
                      <div className="text-slate-400 text-[6px] sm:text-[9px] uppercase tracking-wider">{card.type}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mana Bar */}
            <div className="w-full max-w-2xl bg-slate-900 rounded-full h-6 sm:h-8 border-2 sm:border-4 border-slate-800 relative overflow-hidden shadow-2xl pointer-events-auto">
              <motion.div
                className="h-full bg-gradient-to-r from-fuchsia-600 to-fuchsia-400 shadow-[0_0_20px_rgba(192,38,211,0.6)]"
                initial={{ width: 0 }}
                animate={{ width: `${(me.mana / 10) * 100}%` }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-white font-black text-xs sm:text-lg drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                {Math.floor(me.mana)}
              </div>
              <div className="absolute inset-0 flex">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex-1 border-r border-slate-900/30 last:border-0" />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Challenge Notification */}
      <AnimatePresence>
        {incomingChallenge && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 border-2 border-blue-500 p-6 rounded-3xl shadow-2xl z-[300] w-full max-w-sm mx-4"
          >
            <div className="flex flex-col items-center text-center">
              <Swords className="text-blue-500 mb-4" size={48} />
              <h3 className="text-xl font-black text-white mb-1">{incomingChallenge.name}님의 도전!</h3>
              <p className="text-slate-400 text-sm mb-6">트로피: {incomingChallenge.trophies} | 대전을 수락하시겠습니까?</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    socket?.emit('acceptChallenge', incomingChallenge.id);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black transition-all"
                >
                  수락
                </button>
                <button
                  onClick={() => {
                    socket?.emit('declineChallenge', incomingChallenge.id);
                    setIncomingChallenge(null);
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-black transition-all"
                >
                  거절
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Screen */}
      {matchState.status === 'GAMEOVER' && matchResultInfo && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-[200]"
        >
          <div className="bg-slate-900 p-8 rounded-3xl border-2 border-slate-800 shadow-2xl text-center max-w-sm w-full mx-4">
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="mb-4"
            >
              <Trophy size={64} className={`mx-auto ${matchResultInfo.result === 'win' ? 'text-yellow-400' : 'text-slate-500'}`} />
            </motion.div>

            <h1 className={`text-5xl font-black uppercase tracking-tighter mb-2 
              ${matchResultInfo.result === 'win' ? 'text-yellow-400' : matchResultInfo.result === 'draw' ? 'text-white' : 'text-red-500'}`}>
              {matchResultInfo.result === 'win' ? '승리!' : matchResultInfo.result === 'draw' ? '무승부' : '패배'}
            </h1>

            <div className="flex gap-4 mb-8 justify-center">
              <div className="flex flex-col items-center bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-700 min-w-[100px]">
                <span className="text-slate-500 font-bold uppercase text-[10px]">트로피</span>
                <span className={`text-xl font-black ${matchResultInfo.trophyChange > 0 ? 'text-green-400' : matchResultInfo.trophyChange < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {matchResultInfo.trophyChange > 0 ? `+${matchResultInfo.trophyChange}` : matchResultInfo.trophyChange}
                </span>
              </div>
              <div className="flex flex-col items-center bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-700 min-w-[100px]">
                <span className="text-slate-500 font-bold uppercase text-[10px]">골드</span>
                <span className="text-xl font-black text-yellow-400">
                  +{matchResultInfo.goldChange || 0}
                </span>
              </div>
            </div>

            <button
              onClick={handleReturnToLobby}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-xl hover:bg-blue-500 transition-all shadow-lg"
            >
              로비로 돌아가기
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
