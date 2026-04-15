import React from 'react';
import { Coins, Loader2, Plus, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CardDef } from '../../constants';
import { getCardIcon } from '../../utils/gameIcons';

interface ShopTabProps {
    gold: number;
    handleGacha: (count: number) => void;
    gachaResult: any | any[] | null;
    setGachaResult: (val: any) => void;
    shopCards: string[];
    refreshShop: () => void;
    unlockedCards: string[];
    cardsDef: Record<string, CardDef>;
    setGold: (val: number) => void;
    setUnlockedCards: (updater: (prev: string[]) => string[]) => void;
    setNotification: (notif: { message: string, color: string }) => void;
    saveToServer: (data: any) => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({
    gold,
    handleGacha,
    gachaResult,
    setGachaResult,
    shopCards,
    refreshShop,
    unlockedCards,
    cardsDef,
    setGold,
    setUnlockedCards,
    setNotification,
    saveToServer
}) => {
    return (
        <div className="p-4 sm:p-8 space-y-12">
            {/* Daily Shop Section */}
            <div className="bg-slate-800/30 p-10 rounded-[3rem] border border-slate-700/50 shadow-xl mt-8">
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
                        const card = cardsDef[id];
                        if (!card) return null;
                        const isUnlocked = unlockedCards.includes(id);
                        const price = card.rarity === 'legendary' ? 2000 : card.rarity === 'epic' ? 1000 : card.rarity === 'rare' ? 500 : 200;

                        return (
                            <div key={id} className={`group bg-slate-900/40 p-6 rounded-[2rem] border transition-all flex flex-col items-center text-center ${isUnlocked ? 'border-slate-800 opacity-60' : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/60 shadow-lg'}`}>
                                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-2xl relative" style={{ backgroundColor: card.color + '22' }}>
                                    <div className="absolute inset-0 rounded-2xl border-2 border-white/5" />
                                    {React.cloneElement(getCardIcon(id) as React.ReactElement<any>, { size: 40 })}
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
    );
};
