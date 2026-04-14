import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Info } from 'lucide-react';
import { MatchState } from '../../types/game';

interface MatchResultProps {
    matchState: MatchState;
    myId: string;
    onClose: () => void;
}

export const MatchResult: React.FC<MatchResultProps> = ({ matchState, myId, onClose }) => {
    const isWinner = matchState.winner === myId;

    return (
        <AnimatePresence>
            {matchState.status === 'ENDED' && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 50 }}
                        className="bg-slate-900 border-4 border-slate-700 w-full max-w-lg rounded-[3.5rem] p-12 flex flex-col items-center shadow-[0_0_100px_rgba(59,130,246,0.3)] relative overflow-hidden"
                    >
                        {/* Decorative background rays */}
                        <div className={`absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,${isWinner ? '#facc15' : '#ef4444'}_0%,transparent_70%)]`} />

                        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-2xl relative z-10 ${isWinner ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-red-500 shadow-red-500/50'}`}>
                            {isWinner ? <Trophy size={64} className="text-white" /> : <Info size={64} className="text-white" />}
                        </div>

                        <h2 className={`text-6xl font-black mb-4 uppercase tracking-tighter relative z-10 ${isWinner ? 'text-yellow-500' : 'text-red-500'}`}>
                            {isWinner ? 'VICTORY' : 'DEFEAT'}
                        </h2>

                        <p className="text-slate-400 font-bold mb-10 text-xl text-center relative z-10">
                            {isWinner ? '탁월한 전략입니다! 적군을 섬멸했습니다.' : '패배했습니다... 하지만 다시 도전할 기회가 있습니다!'}
                        </p>

                        <div className="grid grid-cols-2 gap-6 w-full mb-12 relative z-10">
                            <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex flex-col items-center">
                                <span className="text-slate-500 text-xs font-black uppercase mb-2">획득 트로피</span>
                                <div className="flex items-center gap-2">
                                    <Trophy size={20} className="text-blue-500" />
                                    <span className="text-2xl font-black text-white">{isWinner ? '+30' : '-10'}</span>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex flex-col items-center">
                                <span className="text-slate-500 text-xs font-black uppercase mb-2">획득 골드</span>
                                <div className="flex items-center gap-2">
                                    <Coins size={20} className="text-yellow-500" />
                                    <span className="text-2xl font-black text-white">{isWinner ? '+100' : '+10'}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className={`w-full py-6 rounded-3xl font-black text-2xl transition-all shadow-2xl relative z-10 active:scale-95 ${isWinner ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                        >
                            로비로 돌아가기
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
