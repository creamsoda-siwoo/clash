import React from 'react';
import { motion } from 'motion/react';
import { Trophy, HelpCircle } from 'lucide-react';

interface AuthOverlayProps {
    isSignUp: boolean;
    setIsSignUp: (val: boolean) => void;
    email: string;
    setEmail: (val: string) => void;
    pass: string;
    setPass: (val: string) => void;
    username: string;
    setUsername: (val: string) => void;
    handleAuth: () => void;
    setShowGuide: (val: boolean) => void;
    authError: string;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({
    isSignUp,
    setIsSignUp,
    email,
    setEmail,
    pass,
    setPass,
    username,
    setUsername,
    handleAuth,
    setShowGuide,
    authError
}) => {
    return (
        <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6 sm:p-4 z-[200]">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xl bg-slate-900 border-2 border-slate-700/50 rounded-[3rem] p-8 sm:p-12 shadow-[0_0_100px_rgba(59,130,246,0.2)] relative overflow-hidden"
            >
                {/* Decorative Elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-red-600/10 rounded-full blur-[80px]" />

                <div className="flex flex-col items-center mb-10 text-center relative z-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-400 rounded-3xl flex items-center justify-center mb-6 shadow-2xl rotate-3">
                        <Trophy size={48} className="text-white" />
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-2 uppercase">
                        Clash <span className="text-blue-500">Battle</span>
                    </h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Royal Strategic Warfare</p>
                </div>

                <div className="space-y-6 relative z-10">
                    <div className="flex bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800 mb-4">
                        <button
                            onClick={() => setIsSignUp(false)}
                            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${!isSignUp ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500'}`}
                        >
                            로그인
                        </button>
                        <button
                            onClick={() => setIsSignUp(true)}
                            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${isSignUp ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500'}`}
                        >
                            회원가입
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5 ml-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">EMAIL ADDRESS</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner font-bold"
                            />
                        </div>

                        {isSignUp && (
                            <div className="space-y-1.5 ml-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PLAYER NAME</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner font-bold"
                                />
                            </div>
                        )}

                        <div className="space-y-1.5 ml-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PASSWORD</label>
                            <input
                                type="password"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner font-bold"
                            />
                        </div>
                    </div>
                </div>

                {authError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-1 rounded-xl text-center mt-4">
                        {authError}
                    </div>
                )}

                <button
                    onClick={handleAuth}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-5 rounded-2xl font-black text-xl shadow-[0_10px_30px_rgba(59,130,246,0.3)] transition-all transform active:scale-95 flex items-center justify-center gap-3 mt-6"
                >
                    <span>{isSignUp ? '사령관 등록하기' : '사령부 접속하기'}</span>
                </button>

                <button
                    onClick={() => setShowGuide(true)}
                    className="mt-8 flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors w-full font-bold text-sm"
                >
                    <HelpCircle size={18} />
                    <span>게임 방법이 궁금하신가요?</span>
                </button>
            </motion.div>
        </div>
    );
};
