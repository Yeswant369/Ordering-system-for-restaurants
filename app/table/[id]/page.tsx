'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Plus, Minus, ShoppingCart, CheckCircle2, Loader2, ArrowRight, Star, X, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Sample Menu - Premium Descriptions
const MENU = [
    { id: 1, name: 'Paneer Butter Masala', price: 220, category: 'Signature Mains', description: 'Cottage cheese in vibrant tomato velvet gravy.' },
    { id: 2, name: 'Veg Biryani', price: 180, category: 'Rice & Bowls', description: 'Basmati rice with garden fresh vegetables.' },
    { id: 3, name: 'Chicken Biryani', price: 250, category: 'Rice & Bowls', description: 'Classic hyderabadi style slow cooked chicken.' },
    { id: 4, name: 'Butter Naan', price: 40, category: 'Sides', description: 'Freshly baked tandoori bread with butter.' },
    { id: 5, name: 'Coke', price: 30, category: 'Beverages', description: 'Chilled 330ml classic refreshment.' },
];

interface CartItem {
    name: string;
    price: number;
    quantity: number;
}

export default function TablePage() {
    const supabase = createClient();
    const params = useParams();
    const tableId = params.id as string;

    const [customerName, setCustomerName] = useState('');
    const [isNameEntered, setIsNameEntered] = useState(false);
    const [cart, setCart] = useState<Record<number, number>>({});
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [orderStatus, setOrderStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [showCartDrawer, setShowCartDrawer] = useState(false);

    const addToCart = (id: number) => {
        setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    };

    const removeFromCart = (id: number) => {
        setCart((prev) => {
            const newCart = { ...prev };
            if (newCart[id] > 1) {
                newCart[id] -= 1;
            } else {
                delete newCart[id];
            }
            return newCart;
        });
    };

    const cartItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);
    const totalPrice = MENU.reduce((acc, item) => {
        return acc + (cart[item.id] || 0) * item.price;
    }, 0);

    const placeOrder = async () => {
        if (!customerName || cartItemsCount === 0) return;

        setIsPlacingOrder(true);
        const orderItems: CartItem[] = MENU.filter(item => cart[item.id]).map(item => ({
            name: item.name,
            price: item.price,
            quantity: cart[item.id]
        }));

        const { error } = await supabase
            .from('orders')
            .insert({
                table_number: parseInt(tableId),
                customer_name: customerName,
                items: orderItems,
                status: 'pending'
            });

        setIsPlacingOrder(false);
        if (!error) {
            setOrderStatus('success');
            setCart({});
            setShowCartDrawer(false);
        } else {
            setOrderStatus('error');
        }
    };

    // Fade-in animation for page load
    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
    };

    if (!isNameEntered) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-blue-50 to-teal-100">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="glass-card w-full max-w-md space-y-10"
                >
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20">
                            <ShoppingBag className="text-white" size={36} />
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-800">In-Room Dining</h1>
                        <p className="text-slate-500 font-medium tracking-wide flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                            Table {tableId} • Authentication Required
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 uppercase tracking-widest ml-1">Your Name</label>
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="input-modern w-full px-5 py-4 text-lg font-medium bg-white/50"
                            />
                        </div>

                        <button
                            onClick={() => customerName.trim() && setIsNameEntered(true)}
                            disabled={!customerName.trim()}
                            className="btn-gradient w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-lg disabled:opacity-50"
                        >
                            Start Your Service <ArrowRight size={20} />
                        </button>
                    </div>

                    <div className="pt-8 text-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                        Powered by Core Systems
                    </div>
                </motion.div>
            </div>
        );
    }

    if (orderStatus === 'success') {
        return (
            <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-blue-50 to-teal-100">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card text-center max-w-sm">
                    <div className="w-24 h-24 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-teal-500/30">
                        <CheckCircle2 size={56} />
                    </div>
                    <h1 className="text-3xl font-bold mb-3 text-slate-800 tracking-tight">Order Placed!</h1>
                    <p className="text-slate-500 font-medium mb-10">Your culinary experience is now being prepared for Table {tableId}.</p>
                    <button
                        onClick={() => setOrderStatus('idle')}
                        className="text-teal-600 font-bold uppercase tracking-widest text-sm hover:text-teal-700 transition-colors"
                    >
                        Order More Delights
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-40">
            <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white/20 p-6">
                <div className="max-w-2xl mx-auto flex justify-between items-center">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800">In-Room Dining</h2>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 italic">Table {tableId} • Guest: {customerName}</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowCartDrawer(true)}
                        className="relative bg-white shadow-md p-4 rounded-2xl text-slate-700 hover:text-teal-600 transition-all border border-slate-50"
                    >
                        <ShoppingCart size={24} />
                        <AnimatePresence>
                            {cartItemsCount > 0 && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    className="absolute -top-3 -right-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white text-[11px] font-black w-7 h-7 flex items-center justify-center rounded-full shadow-lg shadow-teal-500/30"
                                >
                                    {cartItemsCount}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-6 space-y-12 mt-8">
                {/* Menu Sections */}
                {Array.from(new Set(MENU.map(i => i.category))).map((category) => (
                    <section key={category} className="space-y-6">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">{category}</h3>
                            <div className="h-[2px] w-full bg-slate-200/50 rounded-full" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {MENU.filter(item => item.category === category).map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    whileHover={{ y: -5 }}
                                    className="glass-card flex flex-col justify-between group h-full relative"
                                >
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-teal-600 transition-colors uppercase tracking-tight">{item.name}</h4>
                                            {item.id === 1 && <Star size={16} className="text-yellow-400 fill-yellow-400" />}
                                        </div>
                                        <p className="text-slate-500 text-xs font-medium leading-relaxed italic">{item.description}</p>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between gap-4">
                                        <span className="text-2xl font-black text-slate-800 tabular-nums tracking-tighter">₹{item.price}</span>
                                        <div className="flex items-center gap-3">
                                            {cart[item.id] ? (
                                                <div className="flex items-center bg-teal-50 rounded-xl p-1 border border-teal-100 shadow-inner">
                                                    <button onClick={() => removeFromCart(item.id)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg transition-all text-teal-600">
                                                        <Minus size={18} strokeWidth={3} />
                                                    </button>
                                                    <span className="w-8 text-center font-black text-slate-800 tabular-nums">
                                                        {cart[item.id]}
                                                    </span>
                                                    <button onClick={() => addToCart(item.id)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-lg transition-all text-teal-600">
                                                        <Plus size={18} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => addToCart(item.id)}
                                                    className="bg-white text-teal-600 w-12 h-12 flex items-center justify-center rounded-2xl shadow-sm border border-slate-100 hover:bg-teal-500 hover:text-white transition-all transform hover:rotate-90"
                                                >
                                                    <Plus size={24} strokeWidth={3} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </section>
                ))}
            </main>

            {/* Slide-out Cart Drawer/Panel */}
            <AnimatePresence>
                {showCartDrawer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCartDrawer(false)}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
                        >
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight text-slate-800">Your Selection</h3>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 italic">Review before transmission</p>
                                </div>
                                <button
                                    onClick={() => setShowCartDrawer(false)}
                                    className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                                >
                                    <X size={24} className="text-slate-600" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                {MENU.filter(item => cart[item.id]).length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                                        <ShoppingBag size={80} strokeWidth={1} />
                                        <p className="font-bold uppercase tracking-[0.2em] text-sm">Your basket is empty</p>
                                    </div>
                                ) : (
                                    MENU.filter(item => cart[item.id]).map(item => (
                                        <div key={item.id} className="flex justify-between items-center group">
                                            <div className="space-y-1">
                                                <h5 className="font-bold text-slate-800 uppercase tracking-tight">{item.name}</h5>
                                                <p className="text-[10px] font-bold text-slate-400 tabular-nums tracking-widest uppercase">Verified Plate • ₹{item.price}</p>
                                            </div>
                                            <div className="flex items-center gap-4 bg-teal-50 rounded-xl p-1 border border-teal-100">
                                                <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-teal-600">
                                                    <Minus size={16} strokeWidth={3} />
                                                </button>
                                                <span className="w-6 text-center font-black text-slate-800 tabular-nums">
                                                    {cart[item.id]}
                                                </span>
                                                <button onClick={() => addToCart(item.id)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-teal-600">
                                                    <Plus size={16} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-8">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Total Valuation</span>
                                    <span className="text-3xl font-black text-teal-600 tracking-tighter tabular-nums">₹{totalPrice}</span>
                                </div>
                                <button
                                    onClick={placeOrder}
                                    disabled={isPlacingOrder || cartItemsCount === 0}
                                    className="btn-gradient w-full py-6 rounded-3xl flex items-center justify-center gap-4 text-lg disabled:opacity-50 shadow-xl shadow-teal-500/20"
                                >
                                    {isPlacingOrder ? <Loader2 className="animate-spin" /> : <>Authorize Transmission <ArrowRight size={20} /></>}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Mobile Floating Cart Summary */}
            <AnimatePresence>
                {cartItemsCount > 0 && !showCartDrawer && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-8 left-6 right-6 z-40"
                    >
                        <button
                            onClick={() => setShowCartDrawer(true)}
                            className="btn-gradient w-full p-1 rounded-[2rem] shadow-2xl shadow-teal-500/40 group overflow-hidden"
                        >
                            <div className="flex items-center justify-between bg-white/10 px-8 py-5 rounded-[1.8rem]">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white text-teal-600 font-black w-10 h-10 flex items-center justify-center rounded-full text-sm">
                                        {cartItemsCount}
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-[0.3em]">Review Selection</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xl font-black tabular-nums tracking-tighter italic">₹{totalPrice}</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="mt-40 py-20 border-t border-slate-200/50 flex flex-col items-center gap-6 opacity-40 grayscale pointer-events-none">
                <p className="text-[10px] font-black uppercase tracking-[0.6em] select-none text-slate-500 italic">Operational Interface v4.02 • Secure Node</p>
                <div className="flex gap-4">
                    <div className="w-10 h-px bg-slate-300" />
                    <div className="w-10 h-px bg-slate-300" />
                    <div className="w-10 h-px bg-slate-300" />
                </div>
            </footer>
        </div>
    );
}
