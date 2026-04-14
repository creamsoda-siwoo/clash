import React from 'react';
import { CardDef, CARDS } from '../../constants';

interface SynthesisTabProps {
    fragments: Record<string, number>;
    setFragments: (val: Record<string, number>) => void;
    unlockedCards: string[];
    cardLevels: Record<string, number>;
    setCardLevels: (val: Record<string, number>) => void;
    setNotification: (notif: { message: string, color: string }) => void;
    saveToServer: (data: any) => void;
    trophies: number;
    gold: number;
    selectedDeck: string[];
}

export const SynthesisTab: React.FC<SynthesisTabProps> = ({
    fragments,
    setFragments,
    unlockedCards,
    cardLevels,
    setCardLevels,
    setNotification,
    saveToServer,
    trophies,
    gold,
    selectedDeck
}) => {
    return (
        <div className="p-4 sm:p-8 space-y-8">
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
    );
};
