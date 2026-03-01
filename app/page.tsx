'use client';

import Link from 'next/link';
import { QrCode, ClipboardList, UtensilsCrossed, Send, Zap, ShieldCheck, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-teal-100 flex flex-col items-center justify-center p-8 selection:bg-teal-200">

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
                            className="w-3 h-3 bg-teal-500 rounded-full shadow-lg shadow-teal-500/50"
                        />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-teal-600/80 bg-white shadow-sm px-4 py-2 rounded-full border border-teal-100 italic">Core Operational v1.0</span>
                    </div>

                    <h1 className="text-7xl sm:text-[9rem] font-black tracking-tighter leading-[0.85] text-slate-800 uppercase flex flex-col">
                        <span>Restaurant</span>
                        <span className="text-teal-600 italic">Systems</span>
                    </h1>

                    <p className="text-slate-500 text-sm sm:text-base font-bold max-w-xl uppercase tracking-[0.1em] leading-relaxed italic opacity-80 pl-2">
                        High-precision QR ordering and real-time kitchen logistics. Engineered for performance and secure synchronization.
                    </p>
                </header>

                {/* Main Entry Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link
                        href="/table/1"
                        className="glass-card group relative p-12 border-teal-100/50 hover:border-teal-500/50 transition-all overflow-hidden flex flex-col justify-between h-80"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <QrCode size={160} strokeWidth={1} />
                        </div>
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="bg-teal-50 text-teal-600 self-start px-4 py-1 font-black text-[10px] uppercase tracking-widest inline-block border border-teal-100 rounded-full">
                                Guest Interface
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-4xl font-black uppercase tracking-tight text-slate-800">Order Terminal</h3>
                                <div className="flex items-center gap-4 text-teal-600 opacity-60 group-hover:opacity-100 transition-all font-black text-[11px] uppercase tracking-[0.3em] italic">
                                    Initialize Node 01 <Send size={16} />
                                </div>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/dashboard"
                        className="glass-card group relative p-12 border-blue-100/50 hover:border-blue-500/50 transition-all overflow-hidden flex flex-col justify-between h-80"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity size={160} strokeWidth={1} />
                        </div>
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="bg-blue-50 text-blue-600 self-start px-4 py-1 font-black text-[10px] uppercase tracking-widest inline-block border border-blue-100 rounded-full">
                                Administrative Hub
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-4xl font-black uppercase tracking-tight text-slate-800">Management Node</h3>
                                <div className="flex items-center gap-4 text-blue-600 opacity-60 group-hover:opacity-100 transition-all font-black text-[11px] uppercase tracking-[0.3em] italic">
                                    Access Sync Feed <Send size={16} />
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Footer Utility Badges */}
                <div className="flex flex-wrap justify-between items-center gap-12 pt-16 border-t border-slate-200 opacity-40 grayscale pointer-events-none select-none">
                    <div className="flex items-center gap-4">
                        <ShieldCheck size={20} className="text-teal-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 italic">Encrypted Secure Line</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Zap size={20} className="text-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 italic">Real-time Push Engine</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 italic">© 2026 Core Protocols</span>
                    </div>
                </div>
            </motion.div>

            {/* Subtle Gradient Spotlights */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-200/20 blur-[120px] rounded-full -z-10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-200/20 blur-[120px] rounded-full -z-10" />
        </div>
    );
}
