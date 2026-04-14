import React from 'react';
import { motion } from 'motion/react';
import { PachinkoResult } from '../../types/game';

interface PachinkoTabProps {
    gold: number;
    setGold: (updater: (prev: number) => number) => void;
    isSpinning: boolean;
    setIsSpinning: (val: boolean) => void;
    pachinkoResult: PachinkoResult | null;
    setPachinkoResult: (val: PachinkoResult | null) => void;
    saveToServer: (data: any) => void;
    trophies: number;
    cardLevels: Record<string, number>;
    unlockedCards: string[];
    selectedDeck: string[];
    fragments: Record<string, number>;
}

export const PachinkoTab: React.FC<PachinkoTabProps> = ({
    gold,
    setGold,
    isSpinning,
    setIsSpinning,
    pachinkoResult,
    setPachinkoResult,
    saveToServer,
    trophies,
    cardLevels,
    unlockedCards,
    selectedDeck,
    fragments
}) => {
    return (
        <div className="p-8 space-y-8 flex flex-col items-center">
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
                            let result: PachinkoResult;
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
    );
};
