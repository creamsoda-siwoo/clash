import React from 'react';
import { Swords, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { CardDef } from '../../constants';
import { getCardIcon } from '../../utils/gameIcons';

interface DeckTabProps {
    selectedDeck: string[];
    unlockedCards: string[];
    cardsDef: Record<string, CardDef>;
    cardLevels: Record<string, number>;
    gold: number;
    setGold: (updater: (prev: number) => number) => void;
    setCardLevels: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
    setSelectedDeck: (updater: (prev: string[]) => string[]) => void;
    saveToServer: (data: any) => void;
}

export const DeckTab: React.FC<DeckTabProps> = ({
    selectedDeck,
    unlockedCards,
    cardsDef,
    cardLevels,
    gold,
    setGold,
    setCardLevels,
    setSelectedDeck,
    saveToServer
}) => {
    const sortedRarities = ['legendary', 'epic', 'rare', 'common'] as const;

    return (
        <div className="p-4 sm:p-8">
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
                </div>
            </div>

            {sortedRarities.map(rarity => {
                const allCardsInRarity = Object.keys(cardsDef).filter(id => cardsDef[id]?.rarity === rarity);
                if (allCardsInRarity.length === 0) return null;

                return (
                    <div key={rarity} className="mb-10">
                        <h3 className={`text-xl font-black mb-4 uppercase tracking-tighter ${rarity === 'legendary' ? 'text-yellow-400' : rarity === 'epic' ? 'text-purple-400' : rarity === 'rare' ? 'text-orange-400' : 'text-slate-400'}`}>
                            {rarity} CARDS
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                            {allCardsInRarity.map(id => {
                                const card = cardsDef[id];
                                const isUnlocked = unlockedCards.includes(id);
                                const isSelected = selectedDeck.includes(id);
                                const level = cardLevels[id] || 1;
                                const upgradeCost = level * 100;

                                return (
                                    <motion.div
                                        key={id}
                                        whileHover={isUnlocked ? { y: -5 } : {}}
                                        className={`relative p-3 rounded-2xl border-2 transition-all cursor-pointer bg-slate-800/80 backdrop-blur-sm shadow-xl
                                            ${isSelected ? 'border-blue-500 shadow-blue-500/20' : isUnlocked ? 'border-slate-700 hover:border-slate-500' : 'border-slate-900 opacity-40 grayscale'}
                                        `}
                                        onClick={() => {
                                            if (!isUnlocked) return;
                                            if (isSelected) {
                                                setSelectedDeck(prev => prev.filter(cid => cid !== id));
                                            } else if (selectedDeck.length < 6) {
                                                setSelectedDeck(prev => [...prev, id]);
                                            }
                                        }}
                                    >
                                        {!isUnlocked && (
                                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                                 <div className="bg-slate-950/80 px-2 py-1 rounded-lg text-[10px] font-black text-white flex items-center gap-1">
                                                    🔒 잠김
                                                 </div>
                                            </div>
                                        )}
                                        {isSelected && (
                                            <div className="absolute -top-2 -left-2 bg-blue-600 text-white rounded-full p-1 shadow-lg z-10">
                                                <Swords size={12} />
                                            </div>
                                        )}
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-inner relative" style={{ backgroundColor: isUnlocked ? card.color + '33' : '#1e293b' }}>
                                                {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 32 })}
                                                {isUnlocked && (
                                                    <div className="absolute -bottom-2 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-black text-yellow-500">
                                                        Lv.{level}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-white text-xs font-black text-center truncate w-full mb-1">{card.name}</span>
                                            <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-0.5 rounded-full">
                                                <Zap size={10} className="text-blue-400" />
                                                <span className="text-[10px] font-black text-blue-400">{card.cost}</span>
                                            </div>

                                            {isUnlocked && level < 10 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (gold >= upgradeCost) {
                                                            setGold(g => {
                                                                const newG = g - upgradeCost;
                                                                setCardLevels(prev => {
                                                                    const newL = { ...prev, [id]: level + 1 };
                                                                    saveToServer({ gold: newG, cardLevels: newL });
                                                                    return newL;
                                                                });
                                                                return newG;
                                                            });
                                                        }
                                                    }}
                                                    disabled={gold < upgradeCost}
                                                    className={`mt-4 w-full py-1.5 rounded-xl text-[10px] font-black transition-all ${gold >= upgradeCost ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
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
    );
};
