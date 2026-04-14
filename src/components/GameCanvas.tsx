import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Trophy, Shield, Swords, Target, Zap, Plus, Crosshair, Snowflake, Flame, Skull, Home, Droplets, Heart, Cpu, Loader2, Smile, Users, Coins, LogOut, Book, Award, Info, HelpCircle, ShoppingCart, Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { CARDS, CardDef, TIERS, getTier } from '../constants';

// Modular Components
import { BattleTab } from './lobby/BattleTab';
import { DeckTab } from './lobby/DeckTab';
import { ShopTab } from './lobby/ShopTab';
import { SynthesisTab } from './lobby/SynthesisTab';
import { PachinkoTab } from './lobby/PachinkoTab';
import { UsersTab } from './lobby/UsersTab';
import { HUD } from './game/HUD';
import { GameGuide } from './game/GameGuide';
import { MatchResult } from './game/MatchResult';
import { AuthOverlay } from './auth/AuthOverlay';

// Utils & Types
import { getCardIcon } from '../utils/gameIcons';
import { Player, Unit, MatchState, Emote, FloatingText, Mission, PachinkoResult, Base, Tower, Projectile, Effect } from '../types/game';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Auth State
  const [isAppReady, setIsAppReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authError, setAuthError] = useState('');

  // Game Persistence State
  const [myId, setMyId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [gold, setGold] = useState(1000);
  const [trophies, setTrophies] = useState(0);
  const [unlockedCards, setUnlockedCards] = useState<string[]>(['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons']);
  const [cardLevels, setCardLevels] = useState<Record<string, number>>({});
  const [selectedDeck, setSelectedDeck] = useState<string[]>(['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons']);
  const [fragments, setFragments] = useState<Record<string, number>>({ common: 0, rare: 0, epic: 0, legendary: 0 });
  const [claimedTrophyRewards, setClaimedTrophyRewards] = useState<number[]>([]);
  const [hasClaimedDailyBonus, setHasClaimedDailyBonus] = useState(false);

  // Social/Lobby State
  const [isSearching, setIsSearching] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isFetchingLeaderboard, setIsFetchingLeaderboard] = useState(false);
  const [showLobby, setShowLobby] = useState(true);
  const [activeTab, setActiveTab] = useState<'BATTLE' | 'DECK' | 'SHOP' | 'SYNTHESIS' | 'PACHINKO' | 'USERS'>('BATTLE');
  const [showGuide, setShowGuide] = useState(false);
  const [notification, setNotification] = useState<{ message: string, color: string } | null>(null);

  // Tab State
  const [shopCards, setShopCards] = useState<string[]>([]);
  const [gachaResult, setGachaResult] = useState<any | any[] | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [pachinkoResult, setPachinkoResult] = useState<PachinkoResult | null>(null);
  const [missions, setMissions] = useState<Mission[]>([
    { id: 'm1', desc: '전투에서 1회 승리하기', target: 1, current: 0, reward: 200, completed: false },
    { id: 'm2', desc: '유닛 10기 소환하기', target: 10, current: 0, reward: 150, completed: false },
    { id: 'm3', desc: '마법 5회 사용하기', target: 5, current: 0, reward: 100, completed: false },
  ]);

  // Real-time Match State
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [units, setUnits] = useState<Unit[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [matchState, setMatchState] = useState<MatchState>({ status: 'LOBBY', winner: '', timeLeft: 180 });
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showEmoteMenu, setShowEmoteMenu] = useState(false);

  // Camera State
  const [cameraY, setCameraY] = useState(0);
  const isDragging = useRef(false);
  const lastMouseY = useRef(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setMyId(user.uid);
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          setPlayerName(d.username || 'Commander');
          setGold(d.gold ?? 1000);
          setTrophies(d.trophies ?? 0);
          setUnlockedCards(d.unlockedCards || ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons']);
          setSelectedDeck(d.selectedDeck || ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons']);
          setCardLevels(d.cardLevels || {});
          setFragments(d.fragments || { common: 0, rare: 0, epic: 0, legendary: 0 });
          setClaimedTrophyRewards(d.claimedTrophyRewards || []);
          setHasClaimedDailyBonus(d.hasClaimedDailyBonus || false);

          if (d.missions) {
             setMissions(d.missions);
          }
        } else {
          const initial = {
            username: user.displayName || 'Commander',
            gold: 1000,
            trophies: 0,
            unlockedCards: ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons'],
            selectedDeck: ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons'],
            cardLevels: {},
            fragments: { common: 0, rare: 0, epic: 0, legendary: 0 },
            claimedTrophyRewards: [],
            hasClaimedDailyBonus: false,
            missions: [
                { id: 'm1', desc: '전투에서 1회 승리하기', target: 1, current: 0, reward: 200, completed: false },
                { id: 'm2', desc: '유닛 10기 소환하기', target: 10, current: 0, reward: 150, completed: false },
                { id: 'm3', desc: '마법 5회 사용하기', target: 5, current: 0, reward: 100, completed: false },
            ]
          };
          await setDoc(docRef, initial);
          setPlayerName(initial.username);
        }
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setIsAppReady(true);
    });

    // Daily Shop Initialization
    refreshShop();

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !myId) return;

    const newSocket = io('http://localhost:3000', {
      query: { userId: myId, name: playerName }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('syncSocial', { trophies });
    });

    newSocket.on('gameState', (data) => {
      setPlayers(data.players || {});
      setUnits(data.units || []);
      setProjectiles(data.projectiles || []);
      setBases(data.bases || []);
      setTowers(data.towers || []);
      setMatchState(data.matchState || { status: 'LOBBY', winner: '', timeLeft: 180 });
      setEffects(data.effects || []);

      if (data.matchState?.status === 'PLAYING') {
        setShowLobby(false);
        setIsSearching(false);
      } else if (data.matchState?.status === 'ENDED') {
        // Logic for auto-saving results handled on server usually, but we check here for UI
      }
    });

    newSocket.on('matchEnded', async (data) => {
        const isWin = data.winner === myId;
        const rewardGold = isWin ? 100 : 10;
        const trophDiff = isWin ? 30 : -10;

        setGold(g => {
            const newG = g + rewardGold;
            setTrophies(t => {
                const newT = Math.max(0, t + trophDiff);
                saveToServer({ gold: newG, trophies: newT });
                return newT;
            });
            return newG;
        });
    });

    newSocket.on('socialUpdate', (data) => {
      setOnlineUsers(data.onlineUsers || []);
      setOnlineCount(data.onlineCount || 0);
    });

    newSocket.on('emote', (emote) => {
      setEmotes(prev => [...prev, emote]);
      setTimeout(() => setEmotes(prev => prev.filter(e => e.id !== emote.id)), 3000);
    });

    newSocket.on('damageText', (text) => {
      setFloatingTexts(prev => [...prev, text]);
      setTimeout(() => setFloatingTexts(prev => prev.filter(ft => ft.id !== text.id)), 1000);
    });

    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, [isLoggedIn, myId]);

  useEffect(() => {
    if (activeTab === 'USERS') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  const saveToServer = async (updates: any) => {
    if (!myId) return;
    try {
      await setDoc(doc(db, 'users', myId), updates, { merge: true });
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const fetchLeaderboard = async () => {
    setIsFetchingLeaderboard(true);
    try {
      const q = query(collection(db, 'users'), orderBy('trophies', 'desc'), limit(10));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeaderboard(list);
    } finally {
      setIsFetchingLeaderboard(false);
    }
  };

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'LOGIN') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', cred.user.uid), { 
            username, 
            gold: 1000, 
            trophies: 0, 
            unlockedCards: ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons'],
            selectedDeck: ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons'],
            cardLevels: {},
            fragments: { common: 0, rare: 0, epic: 0, legendary: 0 },
            claimedTrophyRewards: [],
            hasClaimedDailyBonus: false
        });
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleJoinGame = () => {
    if (selectedDeck.length !== 6) {
        setNotification({ message: '전투 덱을 6장 채워주세요!', color: '#ef4444' });
        return;
    }
    setIsSearching(true);
    socket?.emit('joinQueue', { 
        name: playerName,
        deck: selectedDeck, 
        trophies: trophies,
        cardLevels: cardLevels 
    });
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // If it was a drag, don't deploy
    if (Math.abs(e.clientY - lastMouseY.current) > 5) return;

    if (matchState.status !== 'PLAYING' || !selectedCardId || !socket) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top - cameraY;
    socket.emit('deployCard', { cardId: selectedCardId, x, y });
    setSelectedCardId(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouseY.current = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dy = e.clientY - lastMouseY.current;
    setCameraY(prev => {
        const next = prev + dy;
        // Limit scroll (Map is 1600x900)
        return Math.min(0, Math.max(next, window.innerHeight - 900));
    });
    lastMouseY.current = e.clientY;
  };

  const handleWheel = (e: React.WheelEvent) => {
    setCameraY(prev => {
        const next = prev - e.deltaY;
        return Math.min(0, Math.max(next, window.innerHeight - 900));
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    lastMouseY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - lastMouseY.current;
    setCameraY(prev => {
        const next = prev + dy;
        return Math.min(0, Math.max(next, window.innerHeight - 900));
    });
    lastMouseY.current = e.touches[0].clientY;
  };

  const handleGacha = (count: number) => {
    const cost = count === 10 ? 900 : 100;
    if (gold < cost) return;
    
    setGold(prev => {
        const newGold = prev - cost;
        const allCardIds = Object.keys(CARDS);
        const results = [];
        const currentUnlocked = [...unlockedCards];
        const currentFragments = { ...fragments };

        for (let i = 0; i < count; i++) {
            const cardId = allCardIds[Math.floor(Math.random() * allCardIds.length)];
            const isNew = !currentUnlocked.includes(cardId);
            if (isNew) {
                currentUnlocked.push(cardId);
            } else {
                const card = CARDS[cardId];
                currentFragments[card.rarity] = (currentFragments[card.rarity] || 0) + 1;
            }
            results.push({ cardId, isNew });
        }

        setUnlockedCards(currentUnlocked);
        setFragments(currentFragments);
        setGachaResult(count === 1 ? results[0] : results);
        saveToServer({ gold: newGold, unlockedCards: currentUnlocked, fragments: currentFragments });
        return newGold;
    });
  };

  const refreshShop = () => {
     const all = Object.keys(CARDS);
     const shuffled = [...all].sort(() => 0.5 - Math.random());
     setShopCards(shuffled.slice(0, 3));
  };

  const claimTrophyReward = (trophyReq: number, reward: number) => {
     if (trophies >= trophyReq && !claimedTrophyRewards.includes(trophyReq)) {
         setGold(g => {
            const newG = g + reward;
            setClaimedTrophyRewards(prev => {
                const newC = [...prev, trophyReq];
                saveToServer({ gold: newG, claimedTrophyRewards: newC });
                return newC;
            });
            return newG;
         });
         setNotification({ message: `보상 획득! +${reward} 골드`, color: '#22c55e' });
     }
  };

  // Rendering Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animReq: number;
    const render = () => {
      // Resize
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(0, cameraY);

      // Background / Arena
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render Bases & Towers
      bases.forEach(b => {
        ctx.fillStyle = b.team === 'red' ? '#ef4444' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        // HP
        ctx.fillStyle = '#000';
        ctx.fillRect(b.x - 40, b.y - b.radius - 20, 80, 10);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(b.x - 40, b.y - b.radius - 20, (b.hp / b.maxHp) * 80, 10);
      });

      towers.forEach(t => {
        ctx.fillStyle = t.team === 'red' ? '#f87171' : '#60a5fa';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fill();
        // HP
        ctx.fillStyle = '#000';
        ctx.fillRect(t.x - 30, t.y - t.radius - 15, 60, 8);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(t.x - 30, t.y - t.radius - 15, (t.hp / t.maxHp) * 60, 8);
      });

      // Render Units
      units.forEach(u => {
        const card = CARDS[u.cardId];
        ctx.fillStyle = u.team === 'red' ? '#dc2626' : '#2563eb';
        ctx.beginPath();
        ctx.arc(u.x, u.y, 15, 0, Math.PI * 2);
        ctx.fill();
        // HP mini bar
        ctx.fillStyle = '#000';
        ctx.fillRect(u.x - 15, u.y - 25, 30, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(u.x - 15, u.y - 25, (u.hp / u.maxHp) * 30, 4);
      });

      // Render Projectiles
      projectiles.forEach(p => {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Effects
      effects.forEach(e => {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.restore();

      animReq = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animReq);
  }, [units, projectiles, bases, towers, effects]);

  if (!isAppReady) {
    return (
      <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">커맨더 센터 초기화 중...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <AuthOverlay 
        isSignUp={authMode === 'REGISTER'}
        setIsSignUp={(val) => setAuthMode(val ? 'REGISTER' : 'LOGIN')}
        email={email}
        setEmail={setEmail}
        pass={password}
        setPass={setPassword}
        username={username}
        setUsername={setUsername}
        handleAuth={handleAuth}
        setShowGuide={setShowGuide}
        authError={authError}
      />
    );
  }

  const trophyMilestones = [
    { trophies: 100, reward: 200, label: '초보 사령관 상자' },
    { trophies: 300, reward: 500, label: '정예 용병대 보급' },
    { trophies: 500, reward: 1000, label: '실버 리그 진입 축하' },
    { trophies: 1000, reward: 2000, label: '골드 리그 진입 축하' },
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full cursor-grab active:cursor-grabbing touch-none" 
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => isDragging.current = false}
        onMouseLeave={() => isDragging.current = false}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => isDragging.current = false}
      />

      {/* Global Overlays */}
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ y: -100 }} animate={{ y: 50 }} exit={{ y: -100 }} className="absolute top-0 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
            <div className="px-8 py-4 rounded-2xl shadow-2xl border-2 font-black text-2xl" style={{ backgroundColor: notification.color + '22', borderColor: notification.color, color: notification.color }}>
              {notification.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD & Modals */}
      {!showLobby && (
          <HUD 
            me={players[myId]} 
            opponent={(Object.values(players) as Player[]).find((p: Player) => p.id !== myId) || null} 
            cardsDef={CARDS} 
            selectedCardId={selectedCardId} 
            setSelectedCardId={setSelectedCardId} 
            myId={myId} 
          />
      )}

      <MatchResult matchState={matchState} myId={myId} onClose={() => {
          setShowLobby(true);
          setMatchState({ status: 'LOBBY', winner: '', timeLeft: 180 });
          socket?.emit('leaveMatch');
      }} />

      <GameGuide showGuide={showGuide} setShowGuide={setShowGuide} />

      {/* Lobby System */}
      {showLobby && (
        <div className="absolute inset-0 z-20 flex flex-col bg-slate-950 overflow-hidden">
          {/* Top Bar */}
          <div className="p-6 flex justify-between items-center bg-slate-900 border-b border-white/5 shadow-2xl">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-slate-950 px-5 py-2.5 rounded-2xl border border-white/5 shadow-inner">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center font-black text-slate-950 shadow-lg">
                  {playerName.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-black text-sm">{playerName}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                      <Trophy size={12} className="text-yellow-500" />
                      <span className="text-xs font-black text-yellow-500">{trophies}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{getTier(trophies).name}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-white/5">
                <Coins size={20} className="text-yellow-500" />
                <span className="text-lg font-black text-white">{gold.toLocaleString()}</span>
              </div>
              <button 
                onClick={() => signOut(auth)} 
                className="p-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-red-600/20 shadow-lg"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Tabs */}
            <div className="bg-slate-900 px-6 py-2 flex items-center gap-2 border-b border-white/5 overflow-x-auto no-scrollbar">
              {[
                { id: 'BATTLE', label: '전투', icon: <Swords size={18} /> },
                { id: 'DECK', label: '덱', icon: <Target size={18} /> },
                { id: 'SHOP', label: '상점', icon: <ShoppingCart size={18} /> },
                { id: 'SYNTHESIS', label: '강화', icon: <Zap size={18} /> },
                { id: 'PACHINKO', label: '빠칭코', icon: <Dices size={18} /> },
                { id: 'USERS', label: '랭킹', icon: <Users size={18} /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase transition-all whitespace-nowrap
                    ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}
                  `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 relative overflow-hidden">
               <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                  {activeTab === 'BATTLE' && (
                    <BattleTab 
                      selectedDeck={selectedDeck} 
                      cardsDef={CARDS} 
                      cardLevels={cardLevels} 
                      isSearching={isSearching} 
                      handleJoinGame={handleJoinGame} 
                      missions={missions} 
                      gold={gold} 
                      setGold={setGold} 
                      setMissions={setMissions} 
                      setNotification={setNotification} 
                      trophyMilestones={trophyMilestones} 
                      claimedTrophyRewards={claimedTrophyRewards} 
                      trophies={trophies} 
                      claimTrophyReward={claimTrophyReward} 
                      hasClaimedDailyBonus={hasClaimedDailyBonus} 
                      setHasClaimedDailyBonus={setHasClaimedDailyBonus} 
                      saveToServer={saveToServer}
                    />
                  )}
                  {activeTab === 'DECK' && (
                    <DeckTab 
                        selectedDeck={selectedDeck} 
                        unlockedCards={unlockedCards} 
                        cardsDef={CARDS} 
                        cardLevels={cardLevels} 
                        gold={gold} 
                        setGold={setGold} 
                        setCardLevels={setCardLevels} 
                        setSelectedDeck={setSelectedDeck} 
                        saveToServer={saveToServer} 
                    />
                  )}
                  {activeTab === 'SHOP' && (
                    <ShopTab 
                        gold={gold} 
                        handleGacha={handleGacha} 
                        gachaResult={gachaResult} 
                        setGachaResult={setGachaResult} 
                        shopCards={shopCards} 
                        refreshShop={refreshShop} 
                        unlockedCards={unlockedCards} 
                        cardsDef={CARDS} 
                        setGold={setGold} 
                        setUnlockedCards={setUnlockedCards} 
                        setNotification={setNotification} 
                        saveToServer={saveToServer} 
                    />
                  )}
                  {activeTab === 'SYNTHESIS' && (
                      <SynthesisTab 
                        fragments={fragments} 
                        setFragments={setFragments} 
                        unlockedCards={unlockedCards} 
                        cardLevels={cardLevels} 
                        setCardLevels={setCardLevels} 
                        setNotification={setNotification} 
                        saveToServer={saveToServer} 
                        trophies={trophies} 
                        gold={gold} 
                        selectedDeck={selectedDeck} 
                      />
                  )}
                  {activeTab === 'PACHINKO' && (
                      <PachinkoTab 
                        gold={gold} 
                        setGold={setGold} 
                        isSpinning={isSpinning} 
                        setIsSpinning={setIsSpinning} 
                        pachinkoResult={pachinkoResult} 
                        setPachinkoResult={setPachinkoResult} 
                        saveToServer={saveToServer} 
                        trophies={trophies} 
                        cardLevels={cardLevels} 
                        unlockedCards={unlockedCards} 
                        selectedDeck={selectedDeck} 
                        fragments={fragments} 
                      />
                  )}
                  {activeTab === 'USERS' && (
                      <UsersTab 
                          leaderboard={leaderboard} 
                          isFetchingLeaderboard={isFetchingLeaderboard} 
                          onlineUsers={onlineUsers} 
                          onlineCount={onlineCount} 
                          myId={myId} 
                          playerName={playerName} 
                          socket={socket} 
                      />
                  )}
               </div>
            </div>
          </div>

          {/* Quick Access Floating Footer */}
          <div className="p-4 bg-slate-900/50 border-t border-white/5 flex justify-center gap-6">
             <button onClick={() => setShowGuide(true)} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold text-xs">
                <HelpCircle size={16} /> 가이드
             </button>
             <div className="w-px h-4 bg-slate-800" />
             <div className="flex items-center gap-2 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                v1.2.0 - Stable Deployment
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
