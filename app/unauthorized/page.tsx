'use client';

import { ShieldAlert, LogOut, ArrowLeft, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-blue-50 to-teal-100 selection:bg-red-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="glass-card max-w-md w-full p-12 space-y-12 text-center border-red-100/50 shadow-2xl shadow-red-500/10"
            >
                <div className="space-y-6">
                    <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-orange-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-red-500/30">
                        <Lock className="text-white" size={32} strokeWidth={3} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-800 leading-none">Access Restricted</h1>
                        <p className="text-red-500 font-bold uppercase tracking-widest text-[11px] italic">Staff Privileges Required</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-slate-500 text-sm font-medium leading-relaxed uppercase tracking-tight italic">
                        Credentials verified, but you lack the clearances required for the <span className="text-red-600 font-black tracking-widest">management node</span>.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-10">
                    <Link
                        href="/"
                        className="btn-gradient w-full py-5 rounded-2xl flex items-center justify-center gap-4 text-xs uppercase tracking-[0.3em] font-black group transition-all"
                    >
                        <ArrowLeft size={16} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                        Abort Session
                    </Link>

                    <button
                        onClick={() => window.location.href = '/login'}
                        className="w-full bg-slate-50 text-slate-400 font-bold py-5 rounded-2xl hover:text-slate-800 hover:bg-slate-100 transition-all text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 border border-slate-200/50"
                    >
                        <LogOut size={16} strokeWidth={3} />
                        Switch Clearance
                    </button>
                </div>

                <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-4 opacity-30 select-none grayscale cursor-help">
                    <div className="flex items-center gap-6">
                        <ShieldAlert size={16} className="text-red-500" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] italic leading-none">
                        Secure Log ID: ACCESS_DENIED_B_04
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
