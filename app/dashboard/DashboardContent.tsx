'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Clock, Users, Hash, CheckCircle2, AlertCircle, ShoppingBag, LogOut, User as UserIcon, ChefHat, Bell, Activity, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '@supabase/supabase-js';

interface OrderItem {
    name: string;
    price: number;
    quantity: number;
}

interface Order {
    id: string;
    table_number: number;
    customer_name: string;
    items: OrderItem[];
    status: string;
    created_at: string;
}

interface DashboardContentProps {
    user: User;
    role: string;
}

export default function DashboardContent({ user, role }: DashboardContentProps) {
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [newOrderId, setNewOrderId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('/notification.mp3');
        fetchOrders();

        const channel = supabase
            .channel('orders-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders' },
                (payload) => {
                    const newOrder = payload.new as Order;
                    if (newOrder.status === 'pending') {
                        setOrders((prev) => [newOrder, ...prev]);
                        setNewOrderId(newOrder.id);
                        setTimeout(() => setNewOrderId(null), 10000); // Pulse effect for 10s
                        if (audioRef.current) {
                            audioRef.current.play().catch(e => console.error("Sound play failed:", e));
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                (payload) => {
                    const updatedOrder = payload.new as Order;
                    if (updatedOrder.status === 'completed') {
                        setOrders((prev) => prev.filter(o => o.id !== updatedOrder.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchOrders() {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setOrders(data);
        }
        setLoading(false);
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const markAsCompleted = async (orderId: string) => {
        setOrders(prev => prev.filter(o => o.id !== orderId));

        const { error } = await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId);

        if (error) {
            console.error("Error updating order:", error);
            fetchOrders();
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen p-6 md:p-12">
            <div className="max-w-[1700px] mx-auto space-y-12">
                {/* Header Section */}
                <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-3 h-3 bg-teal-500 rounded-full shadow-lg shadow-teal-500/50"
                            />
                            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-teal-600/80 bg-teal-50 px-3 py-1 rounded-full border border-teal-100 italic">Live Sync Operational</span>
                        </div>
                        <h1 className="text-6xl font-black tracking-tighter text-slate-800 uppercase leading-none">
                            Order's <br />
                            <span className="text-teal-600">Terminal</span>
                        </h1>
                        <p className="text-slate-500 font-medium italic opacity-60">Session Node: {role.toUpperCase()} • ID {user.id.slice(0, 6)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        <div className="glass-card flex items-center gap-8 py-3 px-8 shadow-teal-500/5 border-teal-100">
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Total Queue</p>
                                <p className="text-4xl font-black text-slate-800 tabular-nums leading-none tracking-tighter italic">{orders.length}</p>
                            </div>
                            <div className="w-px h-10 bg-slate-100" />
                            <ShoppingBag className="text-teal-500" size={32} />
                        </div>

                        <div className="glass-card flex items-center gap-6 py-3 px-8 shadow-blue-500/5 border-blue-100">
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Authenticated</p>
                                <p className="text-sm font-bold text-slate-700 leading-none truncate max-w-[150px]">{user.email}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <UserIcon size={18} />
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="bg-slate-900 text-white p-5 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200 group"
                        >
                            <LogOut size={24} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-10">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-white/40 animate-pulse rounded-3xl border border-white/20 shadow-xl shadow-teal-500/5" />
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="py-40 text-center glass-card border-dashed"
                    >
                        <ChefHat size={80} className="mx-auto text-teal-200 mb-8" />
                        <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-700">All Platforms Clear</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2 italic">Monitoring incoming transmissions from customer nodes...</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-10 items-start">
                        <AnimatePresence mode="popLayout">
                            {orders.map((order) => (
                                <motion.div
                                    key={order.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        y: 0,
                                        boxShadow: newOrderId === order.id ? "0 0 0 4px rgba(20, 184, 166, 0.2)" : "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
                                    }}
                                    exit={{ opacity: 0, scale: 0.9, rotateX: 10, transition: { duration: 0.35 } }}
                                    className={`glass-card p-0 flex flex-col group transition-all duration-500 border-l-8 ${newOrderId === order.id ? 'border-l-teal-500 animate-[pulse_2s_infinite]' : 'border-l-slate-200 hover:border-l-teal-400'}`}
                                >
                                    {/* Card Header */}
                                    <div className="p-8 border-b border-slate-100 flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-5xl font-black italic tracking-tighter text-slate-800 leading-none">T-{order.table_number}</h2>
                                                {newOrderId === order.id && (
                                                    <span className="bg-teal-500 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.2em] animate-bounce">Priority</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Guest: {order.customer_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl flex items-center gap-2 shadow-inner">
                                                <Clock size={16} className="text-teal-500" />
                                                <span className="text-sm font-black text-teal-700 tracking-tighter tabular-nums italic uppercase">{formatTime(order.created_at)}</span>
                                            </div>
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest select-none">ID-{order.id.slice(0, 4)}</p>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="p-8 flex-1 space-y-6">
                                        <div className="space-y-4">
                                            {order.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center group/item hover:bg-slate-50/50 p-2 rounded-xl transition-all">
                                                    <div className="flex items-center gap-5">
                                                        <span className="text-2xl font-black text-teal-600/30 group-hover/item:text-teal-600 transition-colors tabular-nums italic">
                                                            {item.quantity}x
                                                        </span>
                                                        <div className="space-y-0.5">
                                                            <span className="block text-lg font-bold tracking-tight text-slate-700 uppercase leading-none">{item.name}</span>
                                                            <span className="text-[9px] text-slate-400 font-black tracking-widest uppercase italic">Verified Plated Item</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action CTA */}
                                    <div className="p-4 pt-0">
                                        <button
                                            onClick={() => markAsCompleted(order.id)}
                                            className="w-full btn-gradient py-6 rounded-2xl flex items-center justify-center gap-3 text-sm uppercase tracking-[0.3em] font-black group/btn shadow-teal-500/20"
                                        >
                                            <div className="flex items-center gap-3 group-hover:translate-x-1 transition-transform">
                                                Complete Service <Send size={18} />
                                            </div>
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Operational Footer */}
            <footer className="mt-40 pt-12 border-t border-slate-200/50 flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 select-none grayscale pointer-events-none">
                <div className="flex items-center gap-4">
                    <Activity size={16} className="text-teal-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Interface v4.02 // Secure Sync</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                    Proprietary Monitoring Grid • Data Integrity Verified
                </div>
            </footer>
        </div>
    );
}
