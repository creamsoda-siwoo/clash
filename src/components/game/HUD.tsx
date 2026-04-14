import React from 'react';
import { Shield, Target, Swords, Zap, Heart, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { Player, Unit } from '../../types/game';
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
    myId
}) => {
    if (!me) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-30">
            {/* Opponent Info */}
            {opponent && (
                <div className="absolute top-4 right-4 flex flex-col items-end">
                    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl flex flex-col items-end shadow-2xl">
                        <span className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
                             적 사령관: {opponent.name}
                        </span>
                        <div className="flex gap-2">
                            {opponent.deck.map((id) => {
                                const card = cardsDef[id];
                                if (!card) return null;
                                return (
                                    <div key={id} className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-700 bg-slate-800 shadow-inner" style={{ borderColor: card.color + '66' }}>
                                        {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 16 })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Card Deck & Mana */}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-950/90 to-transparent pt-20 pb-8 px-8 flex flex-col items-center">
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
                                className={`relative w-24 h-32 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-between p-2 shadow-2xl overflow-hidden
                                    ${!canAfford ? 'bg-slate-900 border-slate-800 opacity-60' : 'bg-slate-800 hover:-translate-y-4 border-slate-600'}
                                    ${isSelected ? 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.6)] ring-4 ring-blue-500/20 -translate-y-6' : ''}
                                `}
                            >
                                <div className={`absolute -top-1 -left-1 w-8 h-8 rounded-br-2xl flex items-center justify-center font-black text-white shadow-lg z-10 text-xs ${canAfford ? 'bg-blue-600' : 'bg-slate-700'}`}>
                                    {card.cost}
                                </div>
                                <div className="w-12 h-12 rounded-full flex items-center justify-center mt-2 shadow-inner" style={{ backgroundColor: card.color + '22' }}>
                                    {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 24 })}
                                </div>
                                <div className="text-center w-full">
                                    <div className="text-white font-black text-[10px] uppercase tracking-tighter truncate px-1">{card.name}</div>
                                </div>
                                {isSelected && <motion.div layoutId="selection" className="absolute inset-0 bg-blue-500/10 pointer-events-none" />}
                            </button>
                        );
                    })}
                </div>

                {/* Elixir/Mana Bar */}
                <div className="w-full max-w-xl flex flex-col items-center gap-2 pointer-events-auto">
                    <div className="flex items-center gap-3 w-full">
                         <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center text-white font-black shadow-lg">
                            {Math.floor(me.mana)}
                         </div>
                         <div className="flex-1 h-5 bg-slate-900/80 rounded-full p-1 border border-white/10 shadow-inner overflow-hidden">
                            <motion.div 
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${(me.mana / 10) * 100}%` }}
                                transition={{ type: "spring", stiffness: 50 }}
                            />
                         </div>
                    </div>
                </div>
            </div>

            {/* Left Top - My Info */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-3 rounded-2xl flex items-center gap-4 shadow-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-white border border-white/20">
                        {me.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white font-black text-sm">{me.name}</span>
                        <div className="flex items-center gap-2">
                            <Trophy size={14} className="text-yellow-500" />
                            <span className="text-slate-400 font-bold text-xs">{me.trophies}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
