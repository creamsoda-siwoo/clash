import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Trophy, Shield, Swords, Target, Zap, Plus, Crosshair, Snowflake, Flame, Skull, Home, Droplets, Heart, Cpu, Loader2, Smile, Users, Coins, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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

  // Auth States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    if (isLoggedIn && missions.length === 0) {
      setMissions([
        { id: 'win_1', desc: '전투 1회 완료', target: 1, current: 0, reward: 50, completed: false },
        { id: 'trophy_10', desc: '트로피 10점 획득', target: 10, current: 0, reward: 100, completed: false },
        { id: 'gacha_1', desc: '카드 1회 뽑기', target: 1, current: 0, reward: 30, completed: false }
      ]);
    }
  }, [isLoggedIn, missions.length]);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let userData: any;
        const defaultCards = ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons'];
        
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
          
          // Ensure they have default cards if somehow empty
          const finalUnlocked = loadedUnlocked.length > 0 ? loadedUnlocked : defaultCards;
          const finalDeck = loadedDeck.length === 6 ? loadedDeck : defaultCards;
          
          setUnlockedCards(finalUnlocked);
          setSelectedDeck(finalDeck);
          setFragments(userData.fragments || { common: 0, rare: 0, epic: 0, legendary: 0 });
          setMissions(userData.missions || [
            { id: 'win1', desc: '전투에서 1회 승리하기', target: 1, current: 0, reward: 200, completed: false },
            { id: 'play5', desc: '유닛 5회 소환하기', target: 5, current: 0, reward: 100, completed: false }
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
            selectedDeck: defaultCards,
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
        
        // Sync with socket for online list
        if (socket) {
          socket.emit('updateProfile', { name: userData.username, trophies: userData.trophies });
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
              
              saveToServer({ 
                trophies: newTrophies, 
                gold: newGold, 
                cardLevels, 
                unlockedCards, 
                selectedDeck, 
                fragments,
                level: newLevel,
                xp: newXp,
                missions: newM
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
        ctx.fillRect(base.x - hpWidth/2, base.y - base.radius - 25, hpWidth, 10);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(base.x - hpWidth/2, base.y - base.radius - 25, hpWidth * hpPercent, 10);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(base.x - hpWidth/2, base.y - base.radius - 25, hpWidth, 10);
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
        ctx.fillRect(tower.x - hpWidth/2, tower.y - tower.radius - 15, hpWidth, 6);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(tower.x - hpWidth/2, tower.y - tower.radius - 15, hpWidth * hpPercent, 6);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(tower.x - hpWidth/2, tower.y - tower.radius - 15, hpWidth, 6);
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
        ctx.fillRect(u.x - hpWidth/2, u.y - size - 12, hpWidth, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(u.x - hpWidth/2, u.y - size - 12, hpWidth * hpPercent, 4);
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
    saveToServer({ trophies, gold, cardLevels, unlockedCards, selectedDeck: newDeck, fragments });
  };

  const handleJoinGame = () => {
    if (!socket || selectedDeck.length !== 6) return;
    setIsSearching(true);
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
      case 'mecha': return <Cpu size={24} className="text-slate-900" />;
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

      {/* Double Mana Indicator */}
      {matchState.isDoubleMana && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-400 px-4 py-1 rounded-full border border-yellow-500/50 font-bold text-sm animate-pulse z-40">
          ELIXIR x2
        </div>
      )}

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
                { id: 'USERS', label: '유저', color: 'border-slate-500' }
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

                    {/* Missions Section */}
                    <div className="flex flex-col space-y-4 bg-slate-800/30 p-6 rounded-3xl border border-slate-700/50">
                      <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <Trophy size={20} className="text-yellow-400" />
                        오늘의 미션
                      </h3>
                      <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
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
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'DECK' && (
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <h2 className="text-xl font-bold text-white">보유한 카드</h2>
                    <span className={`font-bold ${selectedDeck.length === 6 ? 'text-green-400' : 'text-red-400'}`}>
                      선택됨: {selectedDeck.length} / 6
                    </span>
                  </div>
                  
                  {['legendary', 'epic', 'rare', 'common'].map(rarity => {
                    const cardsOfRarity = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === rarity);
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
                              <div key={card.id} className={`relative flex flex-col items-center p-1 sm:p-2 rounded-xl border-2 transition-all ${!isUnlocked ? 'opacity-40 grayscale border-slate-800 bg-slate-900' : isSelected ? `bg-slate-800 ${rarityColor} shadow-[0_0_10px_rgba(255,255,255,0.1)] ring-2 ring-blue-500/50` : `bg-slate-900 ${rarityColor} hover:bg-slate-800`}`}>
                                {isSelected && (
                                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full z-10 shadow-lg border border-white/20">
                                    장착됨
                                  </div>
                                )}
                                <button 
                                  className="w-full flex flex-col items-center"
                                  onClick={() => isUnlocked && toggleCardSelection(card.id)}
                                  disabled={!isUnlocked}
                                >
                                  <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-0.5 sm:mb-1" style={{ backgroundColor: card.color }}>
                                    {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 14 })}
                                  </div>
                                  <span className="text-white text-[8px] sm:text-xs font-bold mb-0.5 sm:mb-1 truncate w-full text-center">{card.name}</span>
                                  <div className="absolute top-0.5 right-0.5 bg-blue-600 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white border border-slate-900">
                                    {card.cost}
                                  </div>
                                  {isUnlocked && (
                                    <div className="absolute -bottom-1 bg-yellow-500 px-1 rounded-full text-[7px] sm:text-[8px] font-bold text-slate-900">
                                      Lv.{level}
                                    </div>
                                  )}
                                </button>
                                
                                {isUnlocked && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (gold >= upgradeCost) {
                                        const newL = { ...cardLevels, [card.id]: level + 1 };
                                        setCardLevels(newL);
                                        setGold(g => {
                                          const newG = g - upgradeCost;
                                          saveToServer({ trophies, gold: newG, cardLevels: newL, unlockedCards, selectedDeck, fragments });
                                          return newG;
                                        });
                                      }
                                    }}
                                    disabled={gold < upgradeCost}
                                    className={`mt-1.5 w-full py-0.5 rounded-lg text-[7px] sm:text-[8px] font-bold transition-colors ${gold >= upgradeCost ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                  >
                                    ⬆️ {upgradeCost}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'SHOP' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Gacha Section */}
                    <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 flex flex-col items-center text-center">
                      <h2 className="text-3xl font-black text-white mb-2">카드 뽑기</h2>
                      <p className="text-slate-400 mb-8">새로운 카드를 획득하세요!</p>
                      
                      <div className="relative mb-8">
                        <div className="absolute -inset-4 bg-yellow-500/10 blur-2xl rounded-full" />
                        <div className="w-32 h-32 bg-slate-800 rounded-3xl border-4 border-yellow-500/50 flex items-center justify-center text-6xl shadow-2xl">
                          🎁
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (gold >= 100) {
                            const newGold = gold - 100;
                            setGold(newGold);
                            
                            const rand = Math.random();
                            let targetRarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';
                            if (rand > 0.95) targetRarity = 'legendary';
                            else if (rand > 0.8) targetRarity = 'epic';
                            else if (rand > 0.5) targetRarity = 'rare';

                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === targetRarity);
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => {
                                const newU = [...prev, drawn.id];
                                saveToServer({ trophies, gold: newGold, cardLevels, unlockedCards: newU, selectedDeck, fragments, level, xp, missions });
                                return newU;
                              });
                            } else {
                              setFragments(prev => {
                                const newF = { ...prev, [drawn.rarity]: (prev[drawn.rarity] || 0) + 1 };
                                saveToServer({ trophies, gold: newGold, cardLevels, unlockedCards, selectedDeck, fragments: newF, level, xp, missions });
                                return newF;
                              });
                            }
                            
                            setGachaResult({ cardId: drawn.id, isNew });
                            updateMission('gacha', 1);
                          }
                        }}
                        disabled={gold < 100}
                        className={`w-full py-4 rounded-xl font-black text-xl transition-all flex items-center justify-center gap-2 ${gold >= 100 ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)]' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                      >
                        <span>뽑기</span>
                        <span className="bg-slate-900 text-yellow-500 px-2 py-1 rounded-lg text-sm">100 G</span>
                      </button>

                      {gachaResult && !gachaResult.isSynthesis && cardsDef[gachaResult.cardId] && (
                        <div className="mt-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 animate-in fade-in zoom-in duration-300 w-full">
                          <h3 className="text-yellow-400 font-bold mb-4">
                            {gachaResult.isNew ? '✨ 새로운 카드 획득! ✨' : `중복 카드 (${cardsDef[gachaResult.cardId].rarity.toUpperCase()} 조각 1개 획득)`}
                          </h3>
                          <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-lg" style={{ backgroundColor: cardsDef[gachaResult.cardId].color }}>
                              {React.cloneElement(getCardIcon(gachaResult.cardId) as React.ReactElement, { size: 32 })}
                            </div>
                            <span className="text-2xl font-black text-white">{cardsDef[gachaResult.cardId].name}</span>
                            <span className="text-slate-400 uppercase mt-1 text-sm font-bold tracking-widest">{cardsDef[gachaResult.cardId].rarity}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Daily Deals Section */}
                    <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50">
                      <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                        <Coins className="text-yellow-400" size={24} />
                        오늘의 상점
                      </h2>
                      <div className="grid grid-cols-1 gap-4">
                        {['knight', 'archer', 'giant'].map(id => {
                          const card = cardsDef[id];
                          if (!card) return null;
                          const isUnlocked = unlockedCards.includes(id);
                          const price = card.rarity === 'legendary' ? 2000 : card.rarity === 'epic' ? 1000 : card.rarity === 'rare' ? 500 : 200;
                          
                          return (
                            <div key={id} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: card.color }}>
                                  {getCardIcon(id)}
                                </div>
                                <div>
                                  <div className="text-white font-bold">{card.name}</div>
                                  <div className="text-[10px] text-slate-500 uppercase font-black">{card.rarity}</div>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  if (gold >= price && !isUnlocked) {
                                    setGold(g => g - price);
                                    setUnlockedCards(prev => {
                                      const newU = [...prev, id];
                                      saveToServer({ trophies, gold: gold - price, cardLevels, unlockedCards: newU, selectedDeck, fragments, level, xp, missions });
                                      return newU;
                                    });
                                    setNotification({ message: `${card.name} 카드를 구매했습니다!`, color: '#22c55e' });
                                  }
                                }}
                                disabled={gold < price || isUnlocked}
                                className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${isUnlocked ? 'bg-slate-800 text-slate-500' : gold >= price ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-700 text-slate-500'}`}
                              >
                                {isUnlocked ? '보유 중' : `${price} G`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-slate-500 text-[10px] mt-6 text-center italic">상점 품목은 매일 자정에 갱신됩니다.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'SYNTHESIS' && (
                <div className="flex flex-col items-center justify-center h-full">
                  <h2 className="text-3xl font-black text-white mb-2">카드 조각 합성</h2>
                  <p className="text-slate-400 mb-8">중복 카드로 얻은 조각 3개를 모아 상위 등급 카드를 획득하세요!</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-4xl mb-8">
                    {/* Common -> Rare */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-600 flex flex-col items-center">
                      <h3 className="text-xl font-bold text-slate-300 mb-2">일반 조각</h3>
                      <div className="text-3xl font-black mb-4 text-slate-300">{fragments.common || 0} <span className="text-lg text-slate-500">/ 3</span></div>
                      <button
                        onClick={() => {
                          if ((fragments.common || 0) >= 3) {
                            const newF = {...fragments, common: fragments.common - 3};
                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === 'rare');
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => { 
                                const n = [...prev, drawn.id]; 
                                saveToServer({ trophies, gold, cardLevels, unlockedCards: n, selectedDeck, fragments: newF });
                                return n; 
                              });
                            } else {
                              newF.rare = (newF.rare || 0) + 1;
                              saveToServer({ trophies, gold, cardLevels, unlockedCards, selectedDeck, fragments: newF });
                            }
                            setFragments(newF);
                            setGachaResult({ cardId: drawn.id, isNew, isSynthesis: true });
                          }
                        }}
                        disabled={(fragments.common || 0) < 3}
                        className={`w-full py-3 rounded-xl font-bold transition-all ${fragments.common >= 3 ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                      >
                        레어 합성
                      </button>
                    </div>
                    
                    {/* Rare -> Epic */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-blue-900 flex flex-col items-center">
                      <h3 className="text-xl font-bold text-blue-400 mb-2">레어 조각</h3>
                      <div className="text-3xl font-black mb-4 text-blue-400">{fragments.rare || 0} <span className="text-lg text-slate-500">/ 3</span></div>
                      <button
                        onClick={() => {
                          if ((fragments.rare || 0) >= 3) {
                            const newF = {...fragments, rare: fragments.rare - 3};
                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === 'epic');
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => { 
                                const n = [...prev, drawn.id]; 
                                saveToServer({ trophies, gold, cardLevels, unlockedCards: n, selectedDeck, fragments: newF });
                                return n; 
                              });
                            } else {
                              newF.epic = (newF.epic || 0) + 1;
                              saveToServer({ trophies, gold, cardLevels, unlockedCards, selectedDeck, fragments: newF });
                            }
                            setFragments(newF);
                            setGachaResult({ cardId: drawn.id, isNew, isSynthesis: true });
                          }
                        }}
                        disabled={(fragments.rare || 0) < 3}
                        className={`w-full py-3 rounded-xl font-bold transition-all ${fragments.rare >= 3 ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                      >
                        에픽 합성
                      </button>
                    </div>
                    
                    {/* Epic -> Legendary */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-purple-900 flex flex-col items-center">
                      <h3 className="text-xl font-bold text-purple-400 mb-2">에픽 조각</h3>
                      <div className="text-3xl font-black mb-4 text-purple-400">{fragments.epic || 0} <span className="text-lg text-slate-500">/ 3</span></div>
                      <button
                        onClick={() => {
                          if ((fragments.epic || 0) >= 3) {
                            const newF = {...fragments, epic: fragments.epic - 3};
                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === 'legendary');
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => { 
                                const n = [...prev, drawn.id]; 
                                saveToServer({ trophies, gold, cardLevels, unlockedCards: n, selectedDeck, fragments: newF });
                                return n; 
                              });
                            } else {
                              newF.legendary = (newF.legendary || 0) + 1;
                              saveToServer({ trophies, gold, cardLevels, unlockedCards, selectedDeck, fragments: newF });
                            }
                            setFragments(newF);
                            setGachaResult({ cardId: drawn.id, isNew, isSynthesis: true });
                          }
                        }}
                        disabled={(fragments.epic || 0) < 3}
                        className={`w-full py-3 rounded-xl font-bold transition-all ${fragments.epic >= 3 ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                      >
                        전설 합성
                      </button>
                    </div>

                    {/* Legendary -> Legendary */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-yellow-900 flex flex-col items-center">
                      <h3 className="text-xl font-bold text-yellow-400 mb-2">전설 조각</h3>
                      <div className="text-3xl font-black mb-4 text-yellow-400">{fragments.legendary || 0} <span className="text-lg text-slate-500">/ 3</span></div>
                      <button
                        onClick={() => {
                          if ((fragments.legendary || 0) >= 3) {
                            const newF = {...fragments, legendary: fragments.legendary - 3};
                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === 'legendary');
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => { 
                                const n = [...prev, drawn.id]; 
                                saveToServer({ trophies, gold, cardLevels, unlockedCards: n, selectedDeck, fragments: newF });
                                return n; 
                              });
                            } else {
                              newF.legendary = (newF.legendary || 0) + (newF.legendary || 0) + 1;
                              saveToServer({ trophies, gold, cardLevels, unlockedCards, selectedDeck, fragments: newF });
                            }
                            setFragments(newF);
                            setGachaResult({ cardId: drawn.id, isNew, isSynthesis: true });
                          }
                        }}
                        disabled={(fragments.legendary || 0) < 3}
                        className={`w-full py-3 rounded-xl font-bold transition-all ${fragments.legendary >= 3 ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                      >
                        전설 재합성
                      </button>
                    </div>
                  </div>

                  {gachaResult && gachaResult.isSynthesis && cardsDef[gachaResult.cardId] && (
                    <div className="p-6 bg-slate-900 rounded-2xl border border-purple-500 animate-in fade-in zoom-in duration-300">
                      <h3 className="text-purple-400 font-bold mb-4 text-center">
                        {gachaResult.isNew ? '✨ 합성 성공! 새로운 카드 획득! ✨' : `합성 결과 중복 (${cardsDef[gachaResult.cardId].rarity.toUpperCase()} 조각 1개 획득)`}
                      </h3>
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: cardsDef[gachaResult.cardId].color }}>
                          {getCardIcon(gachaResult.cardId)}
                        </div>
                        <span className="text-2xl font-black text-white">{cardsDef[gachaResult.cardId].name}</span>
                        <span className="text-slate-400 uppercase mt-1">{cardsDef[gachaResult.cardId].rarity}</span>
                      </div>
                    </div>
                  )}
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
                  <h2 className="text-2xl font-black text-white mb-6">접속 중인 유저 ({onlineUsers.length})</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {onlineUsers.map(user => (
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
                    ))}
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
