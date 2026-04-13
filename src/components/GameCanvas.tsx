import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Trophy, Shield, Swords, Target, Zap, Plus, Crosshair, Snowflake, Flame, Skull, Home, Droplets, Heart, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  count?: number;
  isAoE?: boolean;
  duration?: number;
  targetCount?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

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
  const [cardsDef, setCardsDef] = useState<Record<string, CardDef>>({});
  const [matchState, setMatchState] = useState<MatchState>({ status: 'LOBBY', winner: '', timeLeft: 120 });
  
  const [showLobby, setShowLobby] = useState(true);
  const [playerName, setPlayerName] = useState('사령관');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  
  // New States for Deck & Trophies
  const [trophies, setTrophies] = useState<number>(0);
  const [gold, setGold] = useState<number>(0);
  const [cardLevels, setCardLevels] = useState<Record<string, number>>({});
  const [unlockedCards, setUnlockedCards] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'BATTLE' | 'DECK' | 'SHOP' | 'SYNTHESIS'>('BATTLE');
  const [selectedDeck, setSelectedDeck] = useState<string[]>([]);
  const [matchResultInfo, setMatchResultInfo] = useState<{ result: string, trophyChange: number, goldChange: number } | null>(null);
  const [gachaResult, setGachaResult] = useState<{ cardId: string, isNew: boolean, isSynthesis?: boolean } | null>(null);
  const [fragments, setFragments] = useState<Record<string, number>>({ common: 0, rare: 0, epic: 0, legendary: 0 });

  const mousePos = useRef({ x: 0, y: 0 });
  const unitsRef = useRef<Unit[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  useEffect(() => {
    const savedTrophies = localStorage.getItem('trophies');
    if (savedTrophies) setTrophies(parseInt(savedTrophies, 10));

    const savedGold = localStorage.getItem('gold');
    if (savedGold) setGold(parseInt(savedGold, 10));
    else setGold(500); // Initial gold

    const savedLevels = localStorage.getItem('cardLevels');
    if (savedLevels) setCardLevels(JSON.parse(savedLevels));

    const savedUnlocked = localStorage.getItem('unlockedCards');
    if (savedUnlocked) setUnlockedCards(JSON.parse(savedUnlocked));

    const savedFragments = localStorage.getItem('fragments');
    if (savedFragments) setFragments(JSON.parse(savedFragments));

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('init', (data: { id: string, map: { width: number, height: number }, cards: Record<string, CardDef> }) => {
      setMyId(data.id);
      setMapInfo(data.map);
      setCardsDef(data.cards);
      
      const defaultCards = ['knight', 'archer', 'giant', 'fireball', 'arrows', 'skeletons'];
      
      setUnlockedCards(prev => {
        if (prev.length === 0) {
          localStorage.setItem('unlockedCards', JSON.stringify(defaultCards));
          return defaultCards;
        }
        return prev;
      });

      setSelectedDeck(prev => {
        if (prev.length === 0) return defaultCards;
        return prev;
      });
    });

    newSocket.on('syncMatch', (state: MatchState) => {
      setMatchState(state);
    });

    newSocket.on('matchResult', (data: { result: string, trophyChange: number, goldChange: number }) => {
      setMatchResultInfo(data);
      setTrophies(prev => {
        const newTrophies = Math.max(0, prev + data.trophyChange);
        localStorage.setItem('trophies', newTrophies.toString());
        return newTrophies;
      });
      setGold(prev => {
        const newGold = prev + data.goldChange;
        localStorage.setItem('gold', newGold.toString());
        return newGold;
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
    const scale = Math.min(window.innerWidth / mapInfo.width, window.innerHeight / mapInfo.height);
    const offsetX = (window.innerWidth - mapInfo.width * scale) / 2;
    const offsetY = (window.innerHeight - mapInfo.height * scale) / 2;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const logicalX = (clickX - offsetX) / scale;
    const logicalY = (clickY - offsetY) / scale;

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

      const scale = Math.min(window.innerWidth / mapInfo.width, window.innerHeight / mapInfo.height);
      const offsetX = (window.innerWidth - mapInfo.width * scale) / 2;
      const offsetY = (window.innerHeight - mapInfo.height * scale) / 2;

      // Draw Space/Sci-Fi Map Background
      ctx.fillStyle = '#0f172a'; // Dark Slate
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Draw Map Boundary
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, mapInfo.width, mapInfo.height);
      
      // Draw Grid Lines for Sci-Fi feel
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      for (let i = 0; i < mapInfo.width; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, mapInfo.height); ctx.stroke();
      }
      for (let i = 0; i < mapInfo.height; i += 100) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(mapInfo.width, i); ctx.stroke();
      }

      // Draw Center Dividing Line (Neon Purple)
      ctx.fillStyle = '#a855f7'; // Neon Purple
      ctx.globalAlpha = 0.3;
      ctx.fillRect(mapInfo.width / 2 - 10, 0, 20, mapInfo.height);
      ctx.globalAlpha = 1.0;
      
      // Decorative Center Circle
      ctx.beginPath();
      ctx.arc(mapInfo.width / 2, mapInfo.height / 2, 80, 0, Math.PI * 2);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 4;
      ctx.stroke();

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
    if (selectedDeck.includes(cardId)) {
      setSelectedDeck(selectedDeck.filter(id => id !== cardId));
    } else if (selectedDeck.length < 6) {
      setSelectedDeck([...selectedDeck, cardId]);
    }
  };

  const handleJoinGame = () => {
    if (socket && selectedDeck.length === 6) {
      socket.emit('joinGame', { team: 'red', name: playerName, deck: selectedDeck, trophies, cardLevels });
      setShowLobby(false);
      setMatchResultInfo(null);
    }
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
      />
      
      {/* Lobby Screen */}
      {showLobby && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-md z-50 overflow-y-auto py-10">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col h-[80vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h1 className="text-3xl font-black text-white tracking-tight">STELLAR STRIKE</h1>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/50">
                  <span className="text-yellow-400 font-bold">💰 {gold}</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-500/20 px-4 py-2 rounded-full border border-blue-500/50">
                  <Trophy className="text-blue-400" size={20} />
                  <span className="text-blue-400 font-bold">{trophies}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800">
              <button 
                onClick={() => setActiveTab('BATTLE')}
                className={`flex-1 py-4 font-bold text-lg transition-colors ${activeTab === 'BATTLE' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-800/50'}`}
              >
                전투 (BATTLE)
              </button>
              <button 
                onClick={() => setActiveTab('DECK')}
                className={`flex-1 py-4 font-bold text-lg transition-colors ${activeTab === 'DECK' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-800/50'}`}
              >
                덱 & 업그레이드 (DECK)
              </button>
              <button 
                onClick={() => { setActiveTab('SHOP'); setGachaResult(null); }}
                className={`flex-1 py-4 font-bold text-lg transition-colors ${activeTab === 'SHOP' ? 'bg-slate-800 text-white border-b-2 border-yellow-500' : 'text-slate-400 hover:bg-slate-800/50'}`}
              >
                상점 (SHOP)
              </button>
              <button 
                onClick={() => { setActiveTab('SYNTHESIS'); setGachaResult(null); }}
                className={`flex-1 py-4 font-bold text-lg transition-colors ${activeTab === 'SYNTHESIS' ? 'bg-slate-800 text-white border-b-2 border-purple-500' : 'text-slate-400 hover:bg-slate-800/50'}`}
              >
                합성 (SYNTHESIS)
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {activeTab === 'BATTLE' && (
                <div className="flex flex-col h-full justify-between max-w-xl mx-auto">
                  <div>
                    <label className="block text-slate-400 font-bold mb-2 text-center">사령관 이름</label>
                    <input 
                      type="text" 
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 mb-8 text-center text-xl font-bold"
                      maxLength={10}
                    />

                    <div className="mb-8">
                      <h3 className="text-slate-400 font-bold mb-4 text-center">선택된 덱 ({selectedDeck.length}/6)</h3>
                      <div className="flex justify-center gap-3">
                        {selectedDeck.map(id => {
                          const card = cardsDef[id];
                          if (!card) return null;
                          const level = cardLevels[id] || 1;
                          return (
                            <div key={id} className="relative flex flex-col items-center p-3 rounded-xl border-2 border-blue-500 bg-slate-800">
                              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: card.color }}>
                                {getCardIcon(card.id)}
                              </div>
                              <span className="text-white text-xs font-bold">{card.name}</span>
                              <div className="absolute -top-2 -right-2 bg-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-slate-900">
                                {card.cost}
                              </div>
                              <div className="absolute -bottom-2 bg-yellow-500 px-2 rounded-full text-[10px] font-bold text-slate-900">
                                Lv.{level}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleJoinGame}
                    disabled={selectedDeck.length !== 6}
                    className={`w-full py-5 rounded-2xl font-black text-2xl transition-all ${selectedDeck.length === 6 ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.5)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                  >
                    {selectedDeck.length === 6 ? '전투 시작' : '카드를 6장 선택해주세요'}
                  </button>
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
                      <div key={rarity} className="mb-8">
                        <h3 className={`text-lg font-black uppercase mb-3 ${rarityColorText}`}>{rarity}</h3>
                        <div className="grid grid-cols-5 gap-4">
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
                              <div key={card.id} className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all ${!isUnlocked ? 'opacity-40 grayscale border-slate-800 bg-slate-900' : isSelected ? `bg-slate-800 ${rarityColor} shadow-[0_0_15px_rgba(255,255,255,0.2)]` : `bg-slate-900 ${rarityColor} hover:bg-slate-800`}`}>
                                <button 
                                  className="w-full flex flex-col items-center"
                                  onClick={() => isUnlocked && toggleCardSelection(card.id)}
                                  disabled={!isUnlocked}
                                >
                                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: card.color }}>
                                    {getCardIcon(card.id)}
                                  </div>
                                  <span className="text-white text-sm font-bold mb-1">{card.name}</span>
                                  <div className="absolute -top-2 -right-2 bg-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-slate-900">
                                    {card.cost}
                                  </div>
                                  {isUnlocked && (
                                    <div className="absolute -bottom-2 bg-yellow-500 px-2 rounded-full text-[10px] font-bold text-slate-900">
                                      Lv.{level}
                                    </div>
                                  )}
                                </button>
                                
                                {isUnlocked && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (gold >= upgradeCost) {
                                        setGold(g => {
                                          const newG = g - upgradeCost;
                                          localStorage.setItem('gold', newG.toString());
                                          return newG;
                                        });
                                        setCardLevels(prev => {
                                          const newL = { ...prev, [card.id]: level + 1 };
                                          localStorage.setItem('cardLevels', JSON.stringify(newL));
                                          return newL;
                                        });
                                      }
                                    }}
                                    disabled={gold < upgradeCost}
                                    className={`mt-4 w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${gold >= upgradeCost ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                  >
                                    ⬆️ {upgradeCost}G
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
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="bg-slate-800 p-8 rounded-3xl border-2 border-yellow-500/50 text-center max-w-md w-full">
                    <h2 className="text-3xl font-black text-white mb-2">카드 뽑기</h2>
                    <p className="text-slate-400 mb-8">새로운 카드를 획득하세요!</p>
                    
                    <button
                      onClick={() => {
                        if (gold >= 100) {
                          setGold(g => {
                            const newG = g - 100;
                            localStorage.setItem('gold', newG.toString());
                            return newG;
                          });
                          
                          // Gacha Logic
                          const rand = Math.random();
                          let targetRarity = 'common';
                          if (rand > 0.95) targetRarity = 'legendary';
                          else if (rand > 0.8) targetRarity = 'epic';
                          else if (rand > 0.5) targetRarity = 'rare';

                          const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === targetRarity);
                          const drawn = pool[Math.floor(Math.random() * pool.length)];
                          
                          const isNew = !unlockedCards.includes(drawn.id);
                          if (isNew) {
                            setUnlockedCards(prev => {
                              const newU = [...prev, drawn.id];
                              localStorage.setItem('unlockedCards', JSON.stringify(newU));
                              return newU;
                            });
                          } else {
                            setFragments(prev => {
                              const newF = { ...prev, [drawn.rarity]: (prev[drawn.rarity] || 0) + 1 };
                              localStorage.setItem('fragments', JSON.stringify(newF));
                              return newF;
                            });
                          }
                          
                          setGachaResult({ cardId: drawn.id, isNew });
                        }
                      }}
                      disabled={gold < 100}
                      className={`w-full py-4 rounded-xl font-black text-xl transition-all flex items-center justify-center gap-2 ${gold >= 100 ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)]' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                    >
                      <span>뽑기</span>
                      <span className="bg-slate-900 text-yellow-500 px-2 py-1 rounded-lg text-sm">100 G</span>
                    </button>

                    {gachaResult && !gachaResult.isSynthesis && cardsDef[gachaResult.cardId] && (
                      <div className="mt-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 animate-in fade-in zoom-in duration-300">
                        <h3 className="text-yellow-400 font-bold mb-4">
                          {gachaResult.isNew ? '✨ 새로운 카드 획득! ✨' : `중복 카드 (${cardsDef[gachaResult.cardId].rarity.toUpperCase()} 조각 1개 획득)`}
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
                            setFragments(prev => { const n = {...prev, common: prev.common - 3}; localStorage.setItem('fragments', JSON.stringify(n)); return n; });
                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === 'rare');
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => { const n = [...prev, drawn.id]; localStorage.setItem('unlockedCards', JSON.stringify(n)); return n; });
                            } else {
                              setFragments(prev => { const n = {...prev, rare: (prev.rare || 0) + 1}; localStorage.setItem('fragments', JSON.stringify(n)); return n; });
                            }
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
                            setFragments(prev => { const n = {...prev, rare: prev.rare - 3}; localStorage.setItem('fragments', JSON.stringify(n)); return n; });
                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === 'epic');
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => { const n = [...prev, drawn.id]; localStorage.setItem('unlockedCards', JSON.stringify(n)); return n; });
                            } else {
                              setFragments(prev => { const n = {...prev, epic: (prev.epic || 0) + 1}; localStorage.setItem('fragments', JSON.stringify(n)); return n; });
                            }
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
                            setFragments(prev => { const n = {...prev, epic: prev.epic - 3}; localStorage.setItem('fragments', JSON.stringify(n)); return n; });
                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === 'legendary');
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => { const n = [...prev, drawn.id]; localStorage.setItem('unlockedCards', JSON.stringify(n)); return n; });
                            } else {
                              setFragments(prev => { const n = {...prev, legendary: (prev.legendary || 0) + 1}; localStorage.setItem('fragments', JSON.stringify(n)); return n; });
                            }
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
                            setFragments(prev => { const n = {...prev, legendary: prev.legendary - 3}; localStorage.setItem('fragments', JSON.stringify(n)); return n; });
                            const pool = (Object.values(cardsDef) as CardDef[]).filter(c => c.rarity === 'legendary');
                            const drawn = pool[Math.floor(Math.random() * pool.length)];
                            const isNew = !unlockedCards.includes(drawn.id);
                            if (isNew) {
                              setUnlockedCards(prev => { const n = [...prev, drawn.id]; localStorage.setItem('unlockedCards', JSON.stringify(n)); return n; });
                            } else {
                              setFragments(prev => { const n = {...prev, legendary: (prev.legendary || 0) + 1}; localStorage.setItem('fragments', JSON.stringify(n)); return n; });
                            }
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
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl flex flex-col items-end">
                  <span className="text-red-400 font-bold text-sm mb-2">적 사령관: {opponent.name}</span>
                  <div className="flex gap-2">
                    {opponent.deck.map((id: string) => {
                      const card = cardsDef[id];
                      if (!card) return null;
                      return (
                        <div key={id} className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-600" style={{ backgroundColor: card.color }}>
                          {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 16 })}
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
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-950 to-transparent pt-20 pb-6 px-6 flex flex-col items-center pointer-events-none">
            
            {/* Cards */}
            <div className="flex gap-4 mb-6 pointer-events-auto">
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
                    className={`relative w-24 h-32 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-between p-2 bg-slate-800
                      ${!canAfford ? 'opacity-50 grayscale cursor-not-allowed border-slate-700' : 'hover:-translate-y-2 cursor-pointer'}
                      ${isSelected ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] -translate-y-4' : 'border-slate-600'}
                    `}
                  >
                    <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center font-black text-white shadow-lg z-10">
                      {card.cost}
                    </div>
                    
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mt-2" style={{ backgroundColor: card.color }}>
                      {getCardIcon(card.id)}
                    </div>
                    
                    <div className="text-center">
                      <div className="text-white font-bold text-xs">{card.name}</div>
                      <div className="text-slate-400 text-[9px] uppercase tracking-wider">{card.type}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mana Bar */}
            <div className="w-full max-w-2xl bg-slate-900 rounded-full h-6 border-2 border-slate-800 relative overflow-hidden shadow-xl">
              <div 
                className="h-full bg-blue-500 transition-all duration-100 ease-linear"
                style={{ width: `${(me.mana / 10) * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-white font-black text-sm drop-shadow-md">
                마나: {Math.floor(me.mana)} / 10
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

      {/* Game Over Screen */}
      {matchState.status === 'GAMEOVER' && matchResultInfo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-50">
          <Trophy size={100} className={`mb-8 ${matchResultInfo.result === 'win' ? 'text-yellow-400' : 'text-slate-500'}`} />
          
          <h1 className={`text-8xl font-black uppercase tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] 
            ${matchResultInfo.result === 'win' ? 'text-yellow-400' : matchResultInfo.result === 'draw' ? 'text-white' : 'text-red-500'}`}>
            {matchResultInfo.result === 'win' ? 'VICTORY!' : matchResultInfo.result === 'draw' ? 'DRAW' : 'DEFEAT'}
          </h1>
          
          <div className="flex gap-6 mb-12">
            <div className="flex items-center gap-4 bg-slate-800 px-8 py-4 rounded-2xl border border-slate-700">
              <span className="text-2xl text-slate-300 font-bold">트로피 변화:</span>
              <span className={`text-4xl font-black ${matchResultInfo.trophyChange > 0 ? 'text-green-400' : matchResultInfo.trophyChange < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {matchResultInfo.trophyChange > 0 ? `+${matchResultInfo.trophyChange}` : matchResultInfo.trophyChange}
              </span>
            </div>
            <div className="flex items-center gap-4 bg-slate-800 px-8 py-4 rounded-2xl border border-slate-700">
              <span className="text-2xl text-slate-300 font-bold">획득 골드:</span>
              <span className="text-4xl font-black text-yellow-400">
                +{matchResultInfo.goldChange || 0}
              </span>
            </div>
          </div>

          <button 
            onClick={handleReturnToLobby}
            className="flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-xl font-black text-xl hover:bg-slate-200 transition-colors"
          >
            <Home size={24} />
            처음으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
