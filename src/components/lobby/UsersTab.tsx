import React from 'react';
import { Award, Trophy, Users, Loader2 } from 'lucide-react';
import { TIERS } from '../../constants';

interface UsersTabProps {
    leaderboard: any[];
    isFetchingLeaderboard: boolean;
    onlineUsers: any[];
    onlineCount: number;
    myId: string;
    playerName: string;
    socket: any;
}

export const UsersTab: React.FC<UsersTabProps> = ({
    leaderboard,
    isFetchingLeaderboard,
    onlineUsers,
    onlineCount,
    myId,
    playerName,
    socket
}) => {
    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {TIERS.map(tier => (
                    <div key={tier.name} className="bg-slate-800/40 p-3 rounded-2xl border border-slate-700/50 flex flex-col items-center">
                        <span className="text-xl mb-1">{tier.icon}</span>
                        <span className="text-[10px] font-black text-slate-400 mb-1">{tier.name}</span>
                        <span className="text-[8px] font-bold text-slate-500">{tier.minTrophies}+</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-800/30 rounded-[2rem] border border-slate-700/50 overflow-hidden shadow-xl flex flex-col">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                            <Award size={24} className="text-blue-500" />
                            글로벌 랭킹
                        </h3>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] text-slate-500 font-black uppercase tracking-widest border-b border-slate-800/50">
                                    <th className="px-6 py-4">순위</th>
                                    <th className="px-6 py-4">플레이어</th>
                                    <th className="px-6 py-4">레벨</th>
                                    <th className="px-6 py-4">트로피</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                {isFetchingLeaderboard ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center">
                                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                                        </td>
                                    </tr>
                                ) : (
                                    leaderboard.map((user, idx) => (
                                        <tr key={user.id} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-400">#{idx + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs">
                                                        {user.username?.charAt(0)}
                                                    </div>
                                                    <span className="text-white font-bold">{user.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-yellow-500">Lv.{user.level || 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Trophy size={14} className="text-blue-400" />
                                                    <span className="text-white font-black">{user.trophies || 0}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-slate-800/30 rounded-[2rem] border border-slate-700/50 p-6 flex flex-col gap-6 shadow-xl">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                            <Users size={24} className="text-green-500" />
                            현재 접속 중
                        </h3>
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-3 py-1 rounded-full font-black ring-1 ring-green-500/20">
                            {onlineCount} ONLINE
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[400px]">
                        {onlineUsers.map((user) => {
                            const isSocketMe = user.id === myId;
                            return (
                                <div key={user.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${isSocketMe ? 'bg-blue-500/10 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold border border-slate-700 shadow-inner">
                                            {user.name?.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="text-white font-bold flex items-center gap-2">
                                                {user.name}
                                                {isSocketMe && <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded-sm">YOU</span>}
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-bold">{user.trophies} TRPH</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isSocketMe && user.status === 'LOBBY' && (
                                            <button
                                                onClick={() => socket?.emit('sendChallenge', { to: user.id, fromName: playerName })}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 shadow-lg"
                                            >
                                                전투 신청
                                            </button>
                                        )}
                                        {user.status === 'PLAYING' && (
                                            <span className="text-[10px] text-slate-500 font-black px-3 py-1.5 bg-slate-800 rounded-xl border border-slate-700">전투 중</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
