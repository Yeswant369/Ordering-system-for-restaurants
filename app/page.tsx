'use client';

import Link from 'next/link';
import { QrCode, ClipboardList, UtensilsCrossed, Send, Zap, ShieldCheck, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-teal-100/50 flex flex-col items-center justify-center p-8 selection:bg-teal-200">

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="max-w-4xl w-full relative z-10 space-y-16"
            >
                {/* Branding & Authority */}
                <header className="space-y-8 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-4">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-2.5 h-2.5 bg-teal-500 rounded-full"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-600 bg-white shadow-sm px-4 py-2 rounded-full border border-teal-100 italic">Operational v1.0</span>
                    </div>

                    <h1 className="text-7xl sm:text-8xl font-extrabold tracking-tight leading-none text-slate-800 uppercase flex flex-col">
                        <span>Restaurant</span>
                        <span className="text-teal-600 italic">Systems</span>
                    </h1>

                    <p className="text-slate-500 text-sm sm:text-base font-medium max-w-xl tracking-tight leading-relaxed pl-2">
                        Advanced QR-node synchronization for high-performance hospitality. Encrypted, real-time logistics.
                    </p>
                </header>

                {/* Main Entry Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Link
                        href="/table/1"
                        className="glass-card group relative p-12 hover:border-teal-500/30 transition-all flex flex-col justify-between h-80 bg-white/40"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                            <QrCode size={160} strokeWidth={1} />
                        </div>
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="bg-teal-50 text-teal-600 self-start px-4 py-1.5 font-bold text-[10px] uppercase tracking-widest inline-block border border-teal-100 rounded-lg">
                                Customer Node
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-3xl font-extrabold uppercase tracking-tight text-slate-800">Order Terminal</h3>
                                <div className="flex items-center gap-3 text-teal-600/60 group-hover:text-teal-600 transition-all font-bold text-[10px] uppercase tracking-[0.2em]">
                                    Initialize <Send size={14} />
                                </div>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/dashboard"
                        className="glass-card group relative p-12 hover:border-teal-500/30 transition-all flex flex-col justify-between h-80 bg-white/40"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                            <Activity size={160} strokeWidth={1} />
                        </div>
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="bg-teal-50 text-teal-600 self-start px-4 py-1.5 font-bold text-[10px] uppercase tracking-widest inline-block border border-teal-100 rounded-lg">
                                Manager Node
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-3xl font-extrabold uppercase tracking-tight text-slate-800">Management Hub</h3>
                                <div className="flex items-center gap-3 text-teal-600/60 group-hover:text-teal-600 transition-all font-bold text-[10px] uppercase tracking-[0.2em]">
                                    Access Sync <Send size={14} />
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Footer Utility Badges */}
                <div className="flex flex-wrap justify-between items-center gap-12 pt-16 border-t border-slate-200/50 opacity-40">
                    <div className="flex items-center gap-4">
                        <ShieldCheck size={18} className="text-teal-600" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-600">Secure Protocol</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Zap size={18} className="text-teal-600" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-600">Instant Sync</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-600 italic">© 2026 Core</span>
                    </div>
                </div>
            </motion.div>

            {/* Subtle Gradient Spotlights */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-200/10 blur-[150px] rounded-full -z-10" />
        </div>
    );
}
