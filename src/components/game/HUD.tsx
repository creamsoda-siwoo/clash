import React from 'react';
import { Trophy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Player } from '../../types/game';
import { CardDef } from '../../constants';
import { getCardIcon } from '../../utils/gameIcons';

interface HUDProps {
    me: Player;
    opponent: Player | null;
    cardsDef: Record<string, CardDef>;
    selectedCardId: string | null;
    setSelectedCardId: (id: string | null) => void;
    myId: string;
}

export const HUD: React.FC<HUDProps> = ({
    me,
    opponent,
    cardsDef,
    selectedCardId,
    setSelectedCardId,
}) => {
    const [selectedDetailCard, setSelectedDetailCard] = React.useState<CardDef | null>(null);
    const [ultimateCooldown, setUltimateCooldown] = React.useState(0);

    React.useEffect(() => {
        if (ultimateCooldown > 0) {
            const timer = setInterval(() => {
                setUltimateCooldown(prev => Math.max(0, prev - 0.1));
            }, 100);
            return () => clearInterval(timer);
        }
    }, [ultimateCooldown]);

    if (!me) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-30 safe-p-t safe-p-b safe-p-l safe-p-r">
            {/* Opponent Info - Classic style at top right */}
            {opponent && (
                <div className="absolute top-4 right-4 flex flex-col items-end pointer-events-none animate-in fade-in slide-in-from-top duration-500">
                    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl flex flex-col items-end shadow-2xl">
                        <span className="text-red-400 font-bold text-sm mb-2">적 사령관: {opponent.name || 'AI 사령관'}</span>
                        <div className="flex gap-2">
                            {opponent.deck.map((id, i) => {
                                const card = cardsDef[id];
                                if (!card) return null;
                                return (
                                    <button 
                                        key={id + i} 
                                        onClick={() => setSelectedDetailCard(card)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-600 pointer-events-auto hover:scale-110 transition-transform" 
                                        style={{ backgroundColor: card.color }}
                                    >
                                        {React.cloneElement(getCardIcon(card.id) as React.ReactElement<any>, { size: 16 })}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Card Deck & Mana - Classic integrated style */}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-950 to-transparent pt-20 pb-6 px-6 flex flex-col items-center">
                
            {/* Ultimate Spell Slot (Center) */}
            <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
                <button
                    disabled={ultimateCooldown > 0}
                    onClick={() => {
                        const spells = Object.keys(cardsDef).filter(id => cardsDef[id].type === 'spell');
                        const randomSpell = spells[Math.floor(Math.random() * spells.length)];
                        setSelectedCardId(randomSpell);
                        setUltimateCooldown(15);
                    }}
                    className={`w-16 h-16 rounded-full bg-gradient-to-t from-purple-900 to-purple-600 border-4 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center text-white font-black hover:scale-110 active:scale-90 transition-all group overflow-hidden relative
                        ${ultimateCooldown > 0 ? 'grayscale opacity-70 cursor-not-allowed' : 'hover:border-white shadow-[0_0_20px_rgba(168,85,247,0.7)]'}
                    `}
                >
                    <Zap className={`w-8 h-8 ${ultimateCooldown === 0 ? 'group-hover:animate-pulse' : ''}`} />
                    {ultimateCooldown > 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center font-black text-xl">
                            {Math.ceil(ultimateCooldown)}
                        </div>
                    )}
                </button>
                <div className="text-[10px] text-purple-400 font-black text-center mt-1 uppercase tracking-tighter">Ultimate</div>
            </div>

                {/* Cards */}
                <div className="flex gap-4 mb-6 pointer-events-auto">
                    {(me.hand || me.deck || []).map((cardId, i) => {
                        const card = cardsDef[cardId];
                        if (!card) return null;
                        const canAfford = me.mana >= card.cost;
                        const isSelected = selectedCardId === card.id;
                        
                        return (
                            <button
                                key={card.id + i}
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

                {/* Mana Bar - Classic blue style */}
                <div className="w-full max-w-2xl bg-slate-900 rounded-full h-7 border-2 border-slate-700 relative overflow-hidden shadow-2xl pointer-events-auto mt-4">
                    <motion.div 
                        className="h-full bg-blue-500"
                        animate={{ width: `${(me.mana / 10) * 100}%` }}
                        transition={{ ease: "linear", duration: 0.1 }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-white font-black text-sm drop-shadow-md">
                        마나: {Math.floor(me.mana)} / 10
                    </div>
                    <div className="absolute inset-0 flex">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="flex-1 border-r border-white/10 last:border-0" />
                        ))}
                    </div>
                </div>
                <div className="text-[10px] text-slate-600 font-mono mt-2">v4.0 MOBILE-READY</div>
            </div>

            {/* Card Detail Modal - Keeping this as it's a new requested feature but with classic styling */}
            <AnimatePresence>
                {selectedDetailCard && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setSelectedDetailCard(null)}>
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 w-full max-w-xs rounded-3xl border-2 border-slate-800 p-6 shadow-2xl overflow-hidden relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center border-2 border-white/10" style={{ backgroundColor: selectedDetailCard.color + '22' }}>
                                    {getCardIcon(selectedDetailCard.id)}
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-xl font-black text-white">{selectedDetailCard.name}</h3>
                                    <div className="px-2 py-0.5 bg-blue-600 rounded-full w-fit">
                                        <span className="text-[10px] font-black">{selectedDetailCard.cost} COST</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm mb-6">{selectedDetailCard.description}</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                    <span className="text-[10px] text-slate-500 font-bold block">HP</span>
                                    <span className="text-sm font-black text-white">{selectedDetailCard.hp || '-'}</span>
                                </div>
                                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                    <span className="text-[10px] text-slate-500 font-bold block">DAM</span>
                                    <span className="text-sm font-black text-white">{selectedDetailCard.dmg}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDetailCard(null)} className="w-full mt-6 py-3 bg-white text-slate-900 rounded-xl font-black">CLOSE</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
