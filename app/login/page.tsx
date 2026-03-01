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
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-teal-100/50 selection:bg-teal-200">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card max-w-sm w-full p-12 space-y-12 text-center shadow-teal-900/5"
            >
                <div className="space-y-6">
                    <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-teal-600/20">
                        <Lock className="text-white" size={28} />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 uppercase">Access Hub</h1>
                        <p className="text-teal-600 font-bold uppercase tracking-widest text-[9px] italic">Authorized Personnel Node</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        className="btn-gradient w-full py-5 rounded-2xl flex items-center justify-center gap-4 text-xs font-bold group"
                    >
                        Verify Identity
                    </button>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                        Secure Token Transmission Required
                    </p>
                </div>

                <div className="pt-8 border-t border-slate-50 flex flex-col items-center gap-4 opacity-40">
                    <ShieldCheck size={16} className="text-teal-500" />
                    <p className="text-[9px] font-bold uppercase tracking-[0.4em] italic text-slate-400">
                        Integrity Verified // v4.02-S
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
