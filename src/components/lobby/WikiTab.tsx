import React from 'react';
import { CardDef } from '../../constants';
import { getCardIcon } from '../../utils/gameIcons';
import { Shield, Zap, Heart, Swords, Target } from 'lucide-react';

interface WikiTabProps {
    cardsDef: Record<string, CardDef>;
}

export const WikiTab: React.FC<WikiTabProps> = ({ cardsDef }) => {
    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black text-white">사령부 백과사전</h2>
                <p className="text-slate-400 font-medium">모든 유닛과 마법의 상세 정보를 확인하세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.values(cardsDef).map(card => (
                    <div key={card.id} className="bg-slate-900 rounded-3xl border-2 border-slate-800 p-6 hover:border-blue-500/50 transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: card.color + '22' }}>
                                 {(() => {
                                    const icon = getCardIcon(card.id);
                                    return icon ? React.cloneElement(icon as React.ReactElement, { size: 32, style: { color: card.color } }) : <Zap size={32} />;
                                 })()}
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">{card.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                        {card.rarity}
                                    </span>
                                    <span className="flex items-center gap-1 text-blue-400 font-black text-xs">
                                        <Zap size={10} className="fill-blue-400" />
                                        {card.cost}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-400 text-sm leading-relaxed mb-6 min-h-[40px]">
                            {card.description}
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            {card.hp && (
                                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Heart size={12} className="text-red-500" />
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">체력</span>
                                    </div>
                                    <span className="text-sm font-black text-white">{card.hp}</span>
                                </div>
                            )}
                            {card.dmg && (
                                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Swords size={12} className="text-yellow-500" />
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">공격력</span>
                                    </div>
                                    <span className="text-sm font-black text-white">{card.dmg}</span>
                                </div>
                            )}
                            {card.range && (
                                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Target size={12} className="text-blue-500" />
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">사거리</span>
                                    </div>
                                    <span className="text-sm font-black text-white">{card.range}</span>
                                </div>
                            )}
                            {card.atkSpeed && (
                                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Zap size={12} className="text-purple-500" />
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">속도</span>
                                    </div>
                                    <span className="text-sm font-black text-white">{card.atkSpeed / 1000}s</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
