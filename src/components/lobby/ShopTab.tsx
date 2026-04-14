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
            {/* Gacha Section */}
            <div className="flex flex-col items-center">
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
                        ${gold >= 100 ? 'bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-700 text-white' : 'bg-slate-900 border-slate-800 text-slate-600 opacity-50'}
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
                        ${gold >= 900 ? 'bg-gradient-to-br from-blue-600 to-blue-500 border-blue-400 text-white hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]' : 'bg-slate-900 border-slate-800 text-slate-600 opacity-50'}
                      `}
                    >
                        <div className="flex flex-col items-center">
                            <span>10회 소환</span>
                            <div className="flex items-center gap-2 text-white/90 text-sm mt-2 bg-blue-950/50 px-3 py-1 rounded-full font-bold">
                                <Coins size={16} /> 900
                            </div>
                        </div>
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
                                        const card = cardsDef[res.cardId];
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
                                        <h4 className="text-3xl font-black text-white mt-6 tracking-tight">{cardsDef[gachaResult.cardId]?.name}</h4>
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
                        const card = cardsDef[id];
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
    );
};
