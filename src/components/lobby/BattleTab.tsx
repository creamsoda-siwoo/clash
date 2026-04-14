import React from 'react';
import { Trophy, Swords, Medal, Target, Zap, Plus, Loader2 } from 'lucide-react';
import { CardDef } from '../../constants';
import { Mission } from '../../types/game';
import { getCardIcon } from '../../utils/gameIcons';

interface BattleTabProps {
    selectedDeck: string[];
    cardsDef: Record<string, CardDef>;
    cardLevels: Record<string, number>;
    isSearching: boolean;
    handleJoinGame: () => void;
    missions: Mission[];
    gold: number;
    setGold: (updater: (prev: number) => number) => void;
    setMissions: (updater: (prev: Mission[]) => Mission[]) => void;
    setNotification: (notif: { message: string, color: string }) => void;
    trophyMilestones: any[];
    claimedTrophyRewards: number[];
    trophies: number;
    claimTrophyReward: (trophies: number, reward: number) => void;
    hasClaimedDailyBonus: boolean;
    setHasClaimedDailyBonus: (val: boolean) => void;
    saveToServer: (data: any) => void;
}

export const BattleTab: React.FC<BattleTabProps> = ({
    selectedDeck,
    cardsDef,
    cardLevels,
    isSearching,
    handleJoinGame,
    missions,
    gold,
    setGold,
    setMissions,
    setNotification,
    trophyMilestones,
    claimedTrophyRewards,
    trophies,
    claimTrophyReward,
    hasClaimedDailyBonus,
    setHasClaimedDailyBonus,
    saveToServer
}) => {
    return (
        <div className="p-4 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                {/* Battle Section */}
                <div className="lg:col-span-2 flex flex-col items-center space-y-8 bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50">
                    <div className="w-full">
                        <h3 className="text-slate-400 font-black mb-6 text-center uppercase tracking-widest">현재 전투 덱 ({selectedDeck.length}/6)</h3>
                        <div className="flex flex-wrap justify-center gap-4">
                            {selectedDeck.map(id => {
                                const card = cardsDef[id];
                                if (!card) return null;
                                const level = cardLevels[id] || 1;
                                return (
                                    <div key={id} className="relative flex flex-col items-center p-4 rounded-2xl border-2 border-blue-500 bg-slate-800 shadow-lg transform transition-transform hover:scale-105">
                                        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2 shadow-inner" style={{ backgroundColor: card.color }}>
                                            {React.cloneElement(getCardIcon(card.id) as React.ReactElement, { size: 24 })}
                                        </div>
                                        <span className="text-white text-sm font-black">{card.name}</span>
                                        <div className="absolute -top-3 -right-3 bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white border-2 border-slate-900 shadow-lg">
                                            {card.cost}
                                        </div>
                                        <div className="absolute -bottom-2 bg-yellow-500 px-3 py-0.5 rounded-full text-[10px] font-black text-slate-900 shadow-md">
                                            Lv.{level}
                                        </div>
                                    </div>
                                );
                            })}
                            {selectedDeck.length === 0 && (
                                <div className="text-slate-500 font-bold py-10">덱이 비어있습니다. [덱] 탭에서 카드를 선택하세요!</div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-center space-y-6 w-full pt-8 border-t border-slate-800">
                        <button
                            onClick={handleJoinGame}
                            disabled={isSearching || selectedDeck.length !== 6}
                            className={`group relative px-20 py-8 rounded-3xl font-black text-4xl transition-all transform hover:scale-105 active:scale-95 shadow-2xl
                            ${isSearching || selectedDeck.length !== 6
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-br from-blue-600 to-blue-400 text-white hover:shadow-[0_0_50px_rgba(59,130,246,0.5)]'
                                }
                          `}
                        >
                            {isSearching ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>매칭 중...</span>
                                </div>
                            ) : '전투 시작'}
                        </button>
                        <p className="text-slate-500 font-bold">AI와 대결하여 트로피와 골드를 획득하세요!</p>
                    </div>
                </div>

                {/* Right Column: Missions & Trophy Rewards */}
                <div className="flex flex-col space-y-4">
                    {/* Missions Section */}
                    <div className="flex flex-col space-y-4 bg-slate-800/30 p-6 rounded-3xl border border-slate-700/50">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                            <Trophy size={20} className="text-yellow-400" />
                            오늘의 미션
                        </h3>
                        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                            {missions.map(m => (
                                <div key={m.id} className={`p-4 rounded-2xl border transition-all ${m.completed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`font-bold text-sm ${m.completed ? 'text-green-400' : 'text-slate-300'}`}>{m.desc}</span>
                                        {m.completed && (
                                            <button
                                                onClick={() => {
                                                    setGold(g => g + m.reward);
                                                    setMissions(prev => prev.filter(mission => mission.id !== m.id));
                                                    setNotification({ message: `보상 획득! +${m.reward} 골드`, color: '#22c55e' });
                                                }}
                                                className="bg-green-500 text-slate-950 text-[10px] font-black px-2 py-1 rounded-lg hover:bg-green-400 shadow-lg"
                                            >
                                                보상 받기
                                            </button>
                                        )}
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${m.completed ? 'bg-green-500' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                                            style={{ width: `${(m.current / m.target) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10px] text-slate-500 font-bold">{m.current} / {m.target}</span>
                                        <span className="text-[10px] text-yellow-500 font-bold">{m.reward} Gold</span>
                                    </div>
                                </div>
                            ))}
                            {missions.length === 0 && (
                                <div className="text-center py-10 text-slate-500 font-bold italic">모든 미션을 완료했습니다!</div>
                            )}
                            {missions.length > 0 && missions.every(m => m.completed) && (
                                <div className="mt-4 p-4 bg-yellow-500/20 border-2 border-yellow-500 rounded-2xl flex flex-col items-center gap-3">
                                    <span className="text-yellow-400 font-black text-center">🎉 모든 오늘의 미션 완료! 🎉</span>
                                    <button
                                        onClick={() => {
                                            const bonusReward = 500;
                                            setGold(g => {
                                                const newGold = g + bonusReward;
                                                saveToServer({ gold: newGold, missions: [], hasClaimedDailyBonus: true });
                                                return newGold;
                                            });
                                            setMissions(() => []);
                                            setHasClaimedDailyBonus(true);
                                            setNotification({ message: `최종 보상 획득! +${bonusReward} 골드`, color: '#facc15' });
                                        }}
                                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-2 rounded-xl shadow-lg transition-transform active:scale-95"
                                    >
                                        최종 보상 받기 (500G)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Trophy Road Section */}
                    <div className="flex flex-col space-y-4 bg-slate-800/30 p-6 rounded-3xl border border-slate-700/50">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                            <Trophy size={20} className="text-blue-400" />
                            트로피 보상 (Trophy Road)
                        </h3>
                        <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                            {trophyMilestones.map(m => {
                                const isClaimed = claimedTrophyRewards.includes(m.trophies);
                                const canClaim = trophies >= m.trophies && !isClaimed;
                                return (
                                    <div key={m.trophies} className={`p-4 rounded-2xl border flex justify-between items-center ${isClaimed ? 'bg-slate-800/20 border-slate-800 opacity-50' : canClaim ? 'bg-blue-500/10 border-blue-500' : 'bg-slate-900 border-slate-700'}`}>
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-sm">{m.trophies} 트로피 달성</span>
                                            <span className="text-yellow-500 text-xs font-black">{m.label}</span>
                                        </div>
                                        {isClaimed ? (
                                            <span className="text-slate-500 text-xs font-bold">수령 완료</span>
                                        ) : (
                                            <button
                                                onClick={() => claimTrophyReward(m.trophies, m.reward)}
                                                disabled={!canClaim}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${canClaim ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                                            >
                                                {canClaim ? '보상 받기' : '잠김'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
