'use client';

import { createClient } from '@/utils/supabase/client';
import { Lock, Send, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
    const supabase = createClient();

    const handleGoogleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-blue-50 to-teal-100 selection:bg-teal-200">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="glass-card max-w-md w-full p-12 space-y-12 text-center border-teal-100/50 shadow-2xl shadow-teal-500/10"
            >
                <div className="space-y-6">
                    <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-teal-500/30">
                        <Lock className="text-white" size={32} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-800 leading-none">Command Center</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px] italic">Staff Authentication Required</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        className="btn-gradient w-full py-6 rounded-3xl flex items-center justify-center gap-4 text-sm uppercase tracking-[0.3em] font-black group overflow-hidden relative"
                    >
                        <div className="flex items-center gap-4 group-hover:translate-x-1 transition-transform">
                            <img
                                src="https://www.google.com/favicon.ico"
                                alt="Google"
                                className="w-5 h-5 bg-white p-1 rounded-full group-hover:scale-110 transition-transform"
                            />
                            Verify Identity
                        </div>
                    </button>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                        Authorized Personnel Only • Secure Session Node
                    </p>
                </div>

                <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-4 opacity-40">
                    <div className="flex items-center gap-6">
                        <Zap size={16} className="text-teal-500" />
                        <ShieldCheck size={16} className="text-blue-500" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] select-none italic">
                        Logs Encrypted // SHA-256 Integration
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
