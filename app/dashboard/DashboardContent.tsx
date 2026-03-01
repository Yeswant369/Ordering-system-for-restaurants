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
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-2.5 h-2.5 bg-teal-500 rounded-full"
                            />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-600 bg-teal-50 px-3 py-1 rounded-lg border border-teal-100">Live Sync Operational</span>
                        </div>
                        <h1 className="text-5xl font-extrabold tracking-tight text-slate-800 leading-tight uppercase">
                            Order's <br />
                            <span className="text-teal-600">Terminal</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium tracking-wide">Node: {role.toUpperCase()} • {user.email}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-5">
                        <div className="glass-card flex items-center gap-8 py-4 px-8 shadow-teal-500/5 bg-white/40">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Queue Status</p>
                                <p className="text-4xl font-extrabold text-slate-800 tabular-nums italic">{orders.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
                                <ShoppingBag size={24} />
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="bg-slate-800 text-white p-5 rounded-2xl hover:bg-slate-900 transition-all active:scale-95 shadow-xl shadow-slate-200 group"
                        >
                            <LogOut size={24} />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-white/40 animate-pulse rounded-3xl border border-white" />
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-32 text-center glass-card border-dashed border-2 border-slate-100"
                    >
                        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ChefHat size={40} className="text-teal-200" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-700">All Platforms Clear</h2>
                        <p className="text-slate-400 text-sm font-medium mt-1">Monitoring incoming orders from guest nodes...</p>
                    </motion.div>
                ) : (
                    <div className={`grid gap-8 w-full items-start ${orders.length === 1 ? 'grid-cols-1' :
                            orders.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                        }`}>
                        <AnimatePresence mode="popLayout">
                            {orders.map((order) => (
                                <motion.div
                                    key={order.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        boxShadow: newOrderId === order.id ? "0 0 0 4px rgba(20, 184, 166, 0.2)" : "0 25px 50px -12px rgba(0, 0, 0, 0.05)"
                                    }}
                                    whileHover={{
                                        outline: "2px solid #000",
                                        transition: { duration: 0 }
                                    }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                    className={`glass-card p-0 overflow-hidden flex flex-col group border-t-8 outline-offset-0 ${newOrderId === order.id ? 'border-t-teal-500' : 'border-t-slate-100'}`}
                                >
                                    {/* Card Header */}
                                    <div className="p-8 border-b border-slate-50 flex justify-between items-start bg-slate-50/30">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-4xl font-extrabold tracking-tight text-slate-800">T-{order.table_number}</h2>
                                                {newOrderId === order.id && (
                                                    <span className="bg-teal-500 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider animate-pulse">New</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{order.customer_name}</p>
                                        </div>
                                        <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm">
                                            <Clock size={14} className="text-teal-500" />
                                            <span className="text-xs font-bold text-slate-600 tabular-nums">{formatTime(order.created_at)}</span>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="p-8 flex-1 space-y-5">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center group/item p-1">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xl font-extrabold text-teal-500/30 group-hover/item:text-teal-600 transition-colors tabular-nums">
                                                        {item.quantity}×
                                                    </span>
                                                    <div>
                                                        <span className="block text-base font-bold text-slate-700 uppercase tracking-tight">{item.name}</span>
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Confirmed Item</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action CTA */}
                                    <div className="p-4 pt-0">
                                        <button
                                            onClick={() => markAsCompleted(order.id)}
                                            className="w-full btn-gradient py-5 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] font-bold group/btn"
                                        >
                                            Complete Service <Send size={16} />
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
