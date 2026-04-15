import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Home } from 'lucide-react';
import { MatchState } from '../../types/game';

interface MatchResultProps {
    matchState: MatchState;
    myId: string;
    myTeam: string;
    onClose: () => void;
}

export const MatchResult: React.FC<MatchResultProps> = ({ matchState, myId, myTeam, onClose }) => {
    const isWinner = matchState.winner === myTeam;
    const isDraw = matchState.winner === 'draw';

    return (
        <AnimatePresence>
            {matchState.status === 'GAMEOVER' && (
                <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md pointer-events-auto">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center"
                    >
                        <Trophy size={120} className={`mb-8 ${isWinner ? 'text-yellow-400' : 'text-slate-500'}`} />
                        
                        <h1 className={`text-8xl font-black uppercase tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] 
                            ${isWinner ? 'text-yellow-400' : isDraw ? 'text-white' : 'text-red-500'}`}>
                            {isWinner ? 'VICTORY!' : isDraw ? 'DRAW' : 'DEFEAT'}
                        </h1>
                        
                        <div className="flex gap-6 mb-12 mt-8">
                            <div className="flex items-center gap-4 bg-slate-800 px-10 py-5 rounded-2xl border border-slate-700 shadow-2xl">
                                <span className="text-2xl text-slate-300 font-bold">트로피:</span>
                                <span className={`text-4xl font-black ${isWinner ? 'text-green-400' : isDraw ? 'text-slate-400' : 'text-red-400'}`}>
                                    {isWinner ? '+30' : isDraw ? '0' : '-20'}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 bg-slate-800 px-10 py-5 rounded-2xl border border-slate-700 shadow-2xl">
                                <span className="text-2xl text-slate-300 font-bold">획득 골드:</span>
                                <span className="text-4xl font-black text-yellow-400">
                                    {isWinner ? '+50' : '+10'}
                                </span>
                            </div>
                        </div>

                        <button 
                            onClick={onClose}
                            className="flex items-center gap-2 px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-2xl hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95"
                        >
                            <Home size={28} />
                            로비로 돌아가기
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
