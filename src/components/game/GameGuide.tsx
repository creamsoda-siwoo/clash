import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Book, Target, Shield, Heart, Zap, Award } from 'lucide-react';

interface GameGuideProps {
    showGuide: boolean;
    setShowGuide: (val: boolean) => void;
}

export const GameGuide: React.FC<GameGuideProps> = ({ showGuide, setShowGuide }) => {
    return (
        <AnimatePresence>
            {showGuide && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-slate-900 border-2 border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col"
                    >
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-600 rounded-2xl">
                                    <Book size={32} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-4xl font-black text-white tracking-widest uppercase">클래시 배틀 가이드</h2>
                                    <p className="text-blue-400 font-bold">승리하기 위한 전략을 확인하세요!</p>
                                </div>
                            </div>
                            <button onClick={() => setShowGuide(false)} className="p-4 hover:bg-slate-800 rounded-full transition-colors">
                                <X size={32} className="text-slate-500" />
                            </button>
                        </div>

                        <div className="p-10 overflow-y-auto space-y-12 custom-scrollbar">
                            <section>
                                <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                                    <Target className="text-red-500" /> 기본 플레이 규칙
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                                        <h4 className="font-black text-blue-400 mb-2">엘릭서 관리</h4>
                                        <p className="text-slate-400 leading-relaxed text-sm">기지에 가까울수록 엘릭서가 빠르게 회복됩니다. 적진으로 진출할 때는 엘릭서를 모아서 기습하세요!</p>
                                    </div>
                                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                                        <h4 className="font-black text-blue-400 mb-2">승리 조건</h4>
                                        <p className="text-slate-400 leading-relaxed text-sm">상대방의 중앙 메인 타워를 파괴하면 즉시 승리합니다! 측면 타워를 먼저 파괴하면 적진 깊숙이 소환할 수 있습니다.</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                                    <Award className="text-yellow-500" /> 티어 시스템
                                </h3>
                                <div className="bg-slate-800/40 p-8 rounded-[2rem] border border-slate-700/50">
                                    <div className="space-y-4">
                                        <p className="text-slate-300">트로피를 획득하여 티어를 올리세요. 티어가 높을수록 더 강력한 보상을 받을 수 있습니다!</p>
                                        <div className="flex flex-wrap gap-3">
                                            {['🥉 브론즈', '🥈 실버', '🥇 골드', '🔹 플래티넘', '💎 다이아몬드', '🔮 마스터', '👑 그랜드마스터'].map(t => (
                                                <span key={t} className="px-4 py-2 bg-slate-900 rounded-xl text-xs font-black text-slate-300 border border-slate-800">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                                    <Zap className="text-purple-500" /> 상점 및 강화
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                                        <h4 className="font-black text-purple-400 mb-2">카드 소환</h4>
                                        <p className="text-slate-400 leading-relaxed text-sm">골드를 사용하여 새로운 카드를 소환하세요. 10회 연속 소환 시 희귀 등급 이상의 카드를 확정적으로 획득합니다!</p>
                                    </div>
                                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                                        <h4 className="font-black text-purple-400 mb-2">카드 강화</h4>
                                        <p className="text-slate-400 leading-relaxed text-sm">동일한 등급의 카드 조각을 모아 강화 센터에서 카드를 강화하세요. 레벨이 올라갈수록 체력과 공격력이 비약적으로 상승합니다.</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="p-8 bg-blue-600/10 border-t border-slate-800">
                            <button onClick={() => setShowGuide(false)} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-2xl shadow-lg transition-transform active:scale-[0.98]">
                                확인했습니다
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
