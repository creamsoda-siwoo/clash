import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, Sparkles, Box, Ticket, Zap } from 'lucide-react';
import { CardDef } from '../../constants';
import { getCardIcon } from '../../utils/gameIcons';

interface SummonTabProps {
    gold: number;
    handleGacha: (count: number) => void;
    gachaResult: any | any[] | null;
    setGachaResult: (val: any) => void;
    cardsDef: Record<string, CardDef>;
}

export const SummonTab: React.FC<SummonTabProps> = ({
    gold,
    handleGacha,
    gachaResult,
    setGachaResult,
    cardsDef
}) => {
    return (
        <div className="p-8 pb-32 flex flex-col items-center space-y-12">
            <div className="text-center space-y-2">
                <motion.h2 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"
                >
                    고급 카드 소환
                </motion.h2>
                <p className="text-slate-400 font-bold">전설 등급 카드를 노려보세요!</p>
            </div>

            {/* Summon Box Visual */}
            <div className="relative group cursor-pointer" onClick={() => gold >= 100 && handleGacha(1)}>
                <motion.div
                    animate={{ 
                        y: [0, -20, 0],
                        rotate: [0, 2, -2, 0]
                    }}
                    transition={{ 
                        repeat: Infinity, 
                        duration: 5,
                        ease: "easeInOut" 
                    }}
                    className="relative z-10"
                >
                    <div className="w-64 h-64 bg-slate-800 rounded-[3rem] border-4 border-blue-500/50 flex items-center justify-center shadow-[0_40px_80px_-15px_rgba(59,130,246,0.3)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
                        <Box size={120} className="text-blue-400 group-hover:scale-110 transition-transform duration-500" />
                        <Sparkles size={40} className="absolute top-10 right-10 text-yellow-400 animate-pulse" />
                    </div>
                </motion.div>
                <div className="absolute -inset-16 bg-blue-500/10 blur-[80px] rounded-full -z-10 group-hover:bg-blue-500/20 transition-colors" />
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
                <button
                    onClick={() => handleGacha(1)}
                    disabled={gold < 100}
                    className={`flex-1 group relative px-8 py-7 rounded-[2.5rem] font-black text-2xl transition-all active:scale-95 shadow-xl border-2 overflow-hidden
                    ${gold >= 100 ? 'bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-700 text-white' : 'bg-slate-900 border-slate-800 text-slate-600 opacity-50'}
                  `}
                >
                    <div className="relative z-10 flex flex-col items-center">
                        <span className="flex items-center gap-2 italic">1회 소환 <Zap size={20} className="text-yellow-400 fill-yellow-400" /></span>
                        <div className="flex items-center gap-2 text-yellow-500 text-sm mt-3 bg-slate-950/50 px-4 py-1.5 rounded-full font-black">
                            <Coins size={16} /> 100
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => handleGacha(10)}
                    disabled={gold < 900}
                    className={`flex-1 group relative px-8 py-7 rounded-[2.5rem] font-black text-2xl transition-all active:scale-95 shadow-2xl border-2
                    ${gold >= 900 ? 'bg-gradient-to-br from-blue-600 to-purple-600 border-blue-400 text-white hover:shadow-[0_0_50px_rgba(59,130,246,0.5)]' : 'bg-slate-900 border-slate-800 text-slate-600 opacity-50'}
                  `}
                >
                    <div className="relative z-10 flex flex-col items-center">
                        <span className="flex items-center gap-2 italic text-3xl">10회 소환 <Sparkles size={24} className="text-yellow-300" /></span>
                        <div className="flex items-center gap-2 text-white/90 text-sm mt-3 bg-blue-950/50 px-4 py-1.5 rounded-full font-black border border-blue-400/30 shadow-lg">
                            <Coins size={16} /> 900
                        </div>
                    </div>
                </button>
            </div>

            {/* Gacha Results Overlay */}
            <AnimatePresence>
                {gachaResult && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 50, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            className="bg-slate-900/80 border-2 border-slate-700 rounded-[4rem] p-10 w-full max-w-4xl shadow-[0_0_100px_rgba(59,130,246,0.2)]"
                        >
                            <div className="flex justify-between items-center mb-10">
                                <h3 className="text-4xl font-black text-white italic tracking-tighter">소환 결과</h3>
                                <button 
                                    onClick={() => setGachaResult(null)} 
                                    className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 border border-slate-700 transition-all font-black text-2xl"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                                {Array.isArray(gachaResult) ? (
                                    gachaResult.map((res: any, i: number) => {
                                        const card = cardsDef[res.cardId];
                                        return (
                                            <motion.div
                                                key={i}
                                                initial={{ scale: 0, rotate: -10 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                transition={{ delay: i * 0.05, type: "spring" }}
                                                className="flex flex-col items-center gap-3 group"
                                            >
                                                <div className={`w-full aspect-square rounded-3xl border-4 flex items-center justify-center bg-slate-950/50 relative transition-all group-hover:scale-110 shadow-xl ${res.isNew ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)]' : 'border-slate-800'}`}>
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[1.5rem]" />
                                                    {React.cloneElement(getCardIcon(res.cardId) as React.ReactElement<any>, { size: 48 })}
                                                    {res.isNew && (
                                                        <div className="absolute -top-3 -right-3 bg-yellow-500 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full ring-4 ring-slate-900 shadow-xl animate-bounce">
                                                            NEW!
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-xs font-black text-slate-400 uppercase text-center">{card?.name}</span>
                                            </motion.div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full flex flex-col items-center py-10">
                                        <motion.div 
                                            initial={{ scale: 0, rotate: 720 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{ type: "spring", damping: 10 }}
                                        >
                                            <div className={`w-40 h-40 rounded-[2.5rem] border-8 flex items-center justify-center bg-slate-950/50 relative shadow-2xl ${gachaResult.isNew ? 'border-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.5)]' : 'border-slate-800'}`}>
                                                {React.cloneElement(getCardIcon(gachaResult.cardId) as React.ReactElement<any>, { size: 80 })}
                                            </div>
                                        </motion.div>
                                        <h4 className="text-5xl font-black text-white mt-10 tracking-tighter italic">{cardsDef[gachaResult.cardId]?.name}</h4>
                                        <div className="mt-6 px-10 py-3 bg-yellow-500 rounded-full text-lg font-black text-slate-900 shadow-[0_10px_30px_rgba(234,179,8,0.4)] animate-pulse">
                                            {gachaResult.isNew ? '✨ 전설의 카드 출현! ✨' : '카드 조각 +1 획득'}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => setGachaResult(null)}
                                className="w-full mt-12 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black text-2xl shadow-[0_20px_40px_rgba(59,130,246,0.3)] transition-all active:scale-95"
                            >
                                확인
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
