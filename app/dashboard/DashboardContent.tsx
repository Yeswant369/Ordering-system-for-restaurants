'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
    Clock, CheckCircle2, ShoppingBag, LogOut, ChefHat, Activity,
    FileText, Banknote, CreditCard, XCircle, UtensilsCrossed, PlayCircle,
    Download, ArrowUpDown, Calendar, SortAsc, SortDesc, RefreshCw,
    AlertTriangle, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '@supabase/supabase-js';

import { Order, OrderStatus, STATUS_CONFIG } from '@/lib/types';
import { MENU } from '@/lib/constants';
import {
    aggregateByCategory, generateCSV, downloadFile, getWeekRange,
    sortOrders, SortField, SortDirection, WeeklyReportData
} from '@/lib/exportUtils';

interface DashboardContentProps {
    user: User;
    role: string;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status as OrderStatus];
    if (!config) return <span className="text-xs font-bold text-slate-400 uppercase">{status}</span>;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${config.color} ${config.textColor} border ${config.borderColor}`}>
            {config.label}
        </span>
    );
}

export default function DashboardContent({ user, role }: DashboardContentProps) {
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>([]);
    const [payments, setPayments] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [newOrderId, setNewOrderId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'orders' | 'payments' | 'export'>('orders');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Payments sort state
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Export state
    const [weekOffset, setWeekOffset] = useState(0);
    const [exportLoading, setExportLoading] = useState(false);

    // Rejection modal state
    const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Expanded payment details
    const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const ensureActiveStaffRole = useCallback(async () => {
        const { data, error } = await supabase
            .from('staff_roles')
            .select('is_active')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!error && data?.is_active) return;

        const { error: upsertError } = await supabase
            .from('staff_roles')
            .upsert({
                user_id: user.id,
                email: user.email,
                role,
                is_active: true,
            }, { onConflict: 'user_id' });

        if (upsertError) {
            console.error('Unable to sync staff role before action:', upsertError);
        }
    }, [role, supabase, user.email, user.id]);

    useEffect(() => {
        audioRef.current = new Audio('/notification.mp3');
        fetchData();

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
                        setTimeout(() => setNewOrderId(null), 10000);
                        audioRef.current?.play().catch(() => {});
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                (payload) => {
                    const updatedOrder = payload.new as Order;
                    const terminalStates = ['paid', 'rejected', 'cancelled'];

                    if (terminalStates.includes(updatedOrder.status)) {
                        setOrders((prev) => prev.filter(o => o.id !== updatedOrder.id));
                        if (updatedOrder.status === 'paid') {
                            setPayments((prev) => [updatedOrder, ...prev]);
                        }
                        audioRef.current?.play().catch(() => {});
                    } else {
                        // Update in-place
                        setOrders((prev) => {
                            const exists = prev.find(o => o.id === updatedOrder.id);
                            if (exists) {
                                return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
                            }
                            return [updatedOrder, ...prev];
                        });

                        // Pulse + sound for certain status changes
                        if (['cash_pending', 'payment_submitted', 'pending'].includes(updatedOrder.status)) {
                            setNewOrderId(updatedOrder.id);
                            setTimeout(() => setNewOrderId(null), 10000);
                            audioRef.current?.play().catch(() => {});
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchData() {
        setLoading(true);
        const { data: pendingData } = await supabase
            .from('orders')
            .select('*')
            .in('status', ['pending', 'accepted', 'preparing', 'ready', 'billed', 'cash_pending', 'payment_submitted'])
            .order('created_at', { ascending: false });

        if (pendingData) setOrders(pendingData);

        const { data: paidData } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'paid')
            .order('created_at', { ascending: false });

        if (paidData) setPayments(paidData);
        setLoading(false);
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    // ─── Order lifecycle actions (via server transition API) ──


    const runStaffTransition = async (
        action: 'accept' | 'reject' | 'preparing' | 'ready' | 'bill' | 'confirm_payment',
        order: Order,
        payload: Record<string, unknown> = {},
        errorLabel: string = 'Action failed'
    ) => {
        setActionError(null);

        const response = await fetch(`/api/staff/orders/${order.id}/transition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const detail = typeof body?.error === 'string' ? ` (${body.error})` : '';
            setActionError(`${errorLabel}${detail}. Please refresh and try again.`);
            await fetchData();
            return false;
        }

        await fetchData();
        return true;
    };

    const acceptOrder = async (order: Order) => {
        await runStaffTransition('accept', order, {}, 'Unable to accept order');
    };

    const rejectOrder = async (order: Order, reason: string) => {
        await runStaffTransition('reject', order, { reason: reason || 'Rejected by staff' }, 'Unable to reject order');

        setRejectingOrder(null);
        setRejectionReason('');
    };

    const markPreparing = async (order: Order) => {
        await runStaffTransition('preparing', order, {}, 'Unable to mark order as preparing');
    };

    const markReady = async (order: Order) => {
        await runStaffTransition('ready', order, {}, 'Unable to mark order as ready');
    };

    const generateBill = async (order: Order) => {
        const total = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        await runStaffTransition('bill', order, { totalAmount: total }, 'Unable to generate bill');
    };

    const confirmPayment = async (order: Order, mode: 'cash' | 'upi') => {
        await runStaffTransition('confirm_payment', order, { paymentMode: mode }, 'Unable to confirm payment');
    };

    // ─── Export ──────────────────────────────────────────────

    const exportWeeklyReport = async () => {
        setExportLoading(true);
        const { start, end } = getWeekRange(weekOffset);

        const { data: weekOrders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'paid')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false });

        if (error || !weekOrders) {
            console.error("Export error:", error);
            setExportLoading(false);
            return;
        }

        const categories = aggregateByCategory(weekOrders);
        const totalRevenue = weekOrders.reduce((s, o) => s + (o.total_amount || 0), 0);

        const report: WeeklyReportData = {
            weekStart: start.toLocaleDateString('en-IN'),
            weekEnd: end.toLocaleDateString('en-IN'),
            totalOrders: weekOrders.length,
            totalRevenue,
            categories,
            orders: weekOrders,
        };

        const csv = generateCSV(report);
        const filename = `Weekly_Report_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.csv`;
        downloadFile(csv, filename);
        setExportLoading(false);
    };

    // ─── Helpers ─────────────────────────────────────────────

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedPayments = sortOrders(payments, sortField, sortDirection);

    // ─── Status-based action buttons for each order ─────────
    const getOrderActions = (order: Order) => {
        const orderTotal = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        switch (order.status) {
            case 'pending':
                return (
                    <div className="p-4 bg-amber-50/50 space-y-3">
                        <div className="flex gap-2">
                            <button
                                onClick={() => acceptOrder(order)}
                                className="flex-1 bg-teal-600 text-white py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-[0.15em] font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
                            >
                                <CheckCircle2 size={16} /> Accept
                            </button>
                            <button
                                onClick={() => setRejectingOrder(order)}
                                className="flex-1 bg-red-500 text-white py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-[0.15em] font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                            >
                                <XCircle size={16} /> Reject
                            </button>
                        </div>
                    </div>
                );

            case 'accepted':
                return (
                    <div className="p-4 bg-blue-50/50">
                        <button
                            onClick={() => markPreparing(order)}
                            className="w-full bg-violet-600 text-white py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-[0.15em] font-bold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/20"
                        >
                            <PlayCircle size={16} /> Start Preparing
                        </button>
                    </div>
                );

            case 'preparing':
                return (
                    <div className="p-4 bg-violet-50/50">
                        <button
                            onClick={() => markReady(order)}
                            className="w-full bg-emerald-600 text-white py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-[0.15em] font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                        >
                            <UtensilsCrossed size={16} /> Mark Ready
                        </button>
                    </div>
                );

            case 'ready':
                return (
                    <div className="p-4 bg-emerald-50/50">
                        <button
                            onClick={() => generateBill(order)}
                            className="w-full btn-gradient py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-[0.15em] font-bold shadow-lg shadow-teal-500/20"
                        >
                            <FileText size={16} /> Generate Bill
                        </button>
                    </div>
                );

            case 'billed':
                return (
                    <div className="p-4 bg-orange-50/50 flex flex-col gap-3">
                        <span className="text-center text-[10px] font-bold text-orange-600 uppercase tracking-widest animate-pulse">
                            Awaiting Payment
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => confirmPayment(order, 'upi')}
                                className="flex-1 bg-white border-2 border-orange-200 text-orange-600 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold hover:bg-orange-100 transition-colors"
                            >
                                Verify UPI <CreditCard size={14} />
                            </button>
                            <button
                                onClick={() => confirmPayment(order, 'cash')}
                                className="flex-1 bg-white border-2 border-orange-200 text-orange-600 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold hover:bg-orange-100 transition-colors"
                            >
                                Verify Cash <Banknote size={14} />
                            </button>
                        </div>
                    </div>
                );

            case 'payment_submitted':
                return (
                    <div className="p-4 bg-yellow-50/50 flex flex-col gap-3">
                        <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-yellow-700 uppercase tracking-widest">
                            <AlertTriangle size={14} /> Customer claims UPI payment
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => confirmPayment(order, 'upi')}
                                className="flex-1 bg-teal-600 text-white py-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
                            >
                                <CheckCircle2 size={14} /> Confirm Paid
                            </button>
                        </div>
                    </div>
                );

            case 'cash_pending':
                return (
                    <div className="p-4 bg-yellow-50/50">
                        <button
                            onClick={() => confirmPayment(order, 'cash')}
                            className="w-full bg-yellow-400 text-yellow-900 py-5 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-[0.15em] font-bold shadow-yellow-400/20 shadow-lg hover:bg-yellow-500 transition-colors"
                        >
                            Confirm Cash (₹{orderTotal}) <CheckCircle2 size={16} />
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    // ─── Status priority for border coloring ─────────────────
    const getBorderColor = (status: string) => {
        const map: Record<string, string> = {
            pending: 'border-t-amber-400',
            accepted: 'border-t-blue-400',
            preparing: 'border-t-violet-400',
            ready: 'border-t-emerald-400',
            billed: 'border-t-orange-400',
            payment_submitted: 'border-t-yellow-400',
            cash_pending: 'border-t-yellow-400',
        };
        return map[status] || 'border-t-slate-100';
    };

    // ════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════
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
                            Owner <br />
                            <span className="text-teal-600">Terminal</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium tracking-wide">Node: {role.toUpperCase()} • {user.email}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-5">
                        {/* Tab switcher */}
                        <div className="flex items-center bg-white/40 p-1 rounded-2xl shadow-sm border border-slate-100">
                            <button
                                onClick={() => setActiveTab('orders')}
                                className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-teal-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Orders ({orders.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('payments')}
                                className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'payments' ? 'bg-teal-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Payments ({payments.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('export')}
                                className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'export' ? 'bg-teal-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Export
                            </button>
                        </div>

                        <button
                            onClick={fetchData}
                            className="bg-white text-slate-600 p-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm border border-slate-100"
                            title="Refresh data"
                        >
                            <RefreshCw size={20} />
                        </button>

                        <button
                            onClick={handleLogout}
                            className="bg-slate-800 text-white p-5 rounded-2xl hover:bg-slate-900 transition-all active:scale-95 shadow-xl shadow-slate-200 group"
                        >
                            <LogOut size={24} />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                {actionError && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {actionError}
                    </div>
                )}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-white/40 animate-pulse rounded-3xl border border-white" />
                        ))}
                    </div>
                ) : activeTab === 'orders' ? (
                    /* ═══════════ ORDERS TAB ═══════════ */
                    orders.length === 0 ? (
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
                        <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-6 gap-8 w-full items-stretch">
                            <AnimatePresence mode="popLayout">
                                {orders.map((order, index) => {
                                    const total = orders.length;
                                    const lastRowSizeMd = total % 2 || 2;
                                    const isLastRowMd = index >= total - lastRowSizeMd;
                                    const mdSpan = isLastRowMd
                                        ? (lastRowSizeMd === 1 ? 'md:col-span-6' : 'md:col-span-3')
                                        : 'md:col-span-3';

                                    const lastRowSizeXl = total % 3 || 3;
                                    const isLastRowXl = index >= total - lastRowSizeXl;
                                    const xlSpan = isLastRowXl
                                        ? (lastRowSizeXl === 1 ? 'xl:col-span-6' : lastRowSizeXl === 2 ? 'xl:col-span-3' : 'xl:col-span-2')
                                        : 'xl:col-span-2';

                                    const orderTotal = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

                                    return (
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
                                                outline: "2.5px solid #000",
                                                transition: { duration: 0 }
                                            }}
                                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                            className={`glass-card p-0 overflow-hidden flex flex-col group border-t-8 h-full outline-offset-0 ${mdSpan} ${xlSpan} ${getBorderColor(order.status)} ${newOrderId === order.id ? 'ring-2 ring-teal-400 ring-offset-2' : ''}`}
                                        >
                                            {/* Order Header */}
                                            <div className="p-8 border-b border-slate-50 flex justify-between items-start bg-slate-50/30">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <h2 className="text-4xl font-extrabold tracking-tight text-slate-800">T-{order.table_number}</h2>
                                                        {newOrderId === order.id && (
                                                            <span className="bg-teal-500 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider animate-pulse">New</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{order.customer_name}</p>
                                                    <StatusBadge status={order.status} />
                                                </div>
                                                <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm">
                                                    <Clock size={14} className="text-teal-500" />
                                                    <span className="text-xs font-bold text-slate-600 tabular-nums">{formatTime(order.created_at)}</span>
                                                </div>
                                            </div>

                                            {/* Order Items */}
                                            <div className="p-8 flex-1 space-y-5">
                                                {order.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center group/item p-1">
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xl font-extrabold text-teal-500/30 group-hover/item:text-teal-600 transition-colors tabular-nums">
                                                                {item.quantity}×
                                                            </span>
                                                            <div>
                                                                <span className="block text-base font-bold text-slate-700 uppercase tracking-tight">{item.name}</span>
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">₹{item.price}</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-800">₹{item.price * item.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Order Total */}
                                            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Order Total</span>
                                                <span className="text-2xl font-black text-slate-800">₹{orderTotal}</span>
                                            </div>

                                            {/* Status-based action buttons */}
                                            {getOrderActions(order)}
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )
                ) : activeTab === 'payments' ? (
                    /* ═══════════ PAYMENTS TAB ═══════════ */
                    <div className="glass-card p-0 overflow-hidden border border-slate-100 w-full">
                        <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/30">
                            <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase">Received Payments</h2>
                            {/* Sort controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {([
                                    ['date', 'Date'],
                                    ['table', 'Table'],
                                    ['amount', 'Amount'],
                                    ['itemCount', 'Items'],
                                ] as [SortField, string][]).map(([field, label]) => (
                                    <button
                                        key={field}
                                        onClick={() => toggleSort(field)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${sortField === field ? 'bg-teal-500 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        {label}
                                        {sortField === field && (sortDirection === 'asc' ? <SortAsc size={10} /> : <SortDesc size={10} />)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {sortedPayments.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-sm font-medium">
                                No payments received yet...
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {sortedPayments.map((payment) => (
                                    <div key={payment.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                        <div
                                            className="p-6 flex items-center justify-between cursor-pointer"
                                            onClick={() => setExpandedPaymentId(expandedPaymentId === payment.id ? null : payment.id)}
                                        >
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 font-bold shadow-sm">
                                                    T-{payment.table_number}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-base">{payment.customer_name}</h3>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                            <Calendar size={10} /> {formatDate(payment.created_at)}
                                                        </span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                            <Clock size={10} /> {formatTime(payment.created_at)}
                                                        </span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                            {payment.payment_mode === 'cash' ? <Banknote size={10} /> : <CreditCard size={10} />}
                                                            {payment.payment_mode || 'Unknown'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className="text-2xl font-black text-slate-800 tabular-nums">₹{payment.total_amount}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                                                        Verified
                                                    </span>
                                                    <motion.div
                                                        animate={{ rotate: expandedPaymentId === payment.id ? 180 : 0 }}
                                                        className="text-slate-400"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                                    </motion.div>
                                                </div>
                                            </div>
                                        </div>
                                        <AnimatePresence>
                                            {expandedPaymentId === payment.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden bg-slate-50/50 px-6 pb-6"
                                                >
                                                    <div className="bg-white border border-slate-100 rounded-xl p-6 space-y-4">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2">Order Details</h4>
                                                        {payment.items.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center">
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-sm font-extrabold text-teal-500/50">{item.quantity}×</span>
                                                                    <span className="text-sm font-bold text-slate-700">{item.name}</span>
                                                                </div>
                                                                <span className="text-sm font-bold text-slate-600">₹{item.price * item.quantity}</span>
                                                            </div>
                                                        ))}
                                                        {payment.paid_at && (
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-2 border-t border-slate-100">
                                                                Verified at: {new Date(payment.paid_at).toLocaleString('en-IN')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* ═══════════ EXPORT TAB ═══════════ */
                    <div className="glass-card max-w-2xl mx-auto space-y-8">
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-teal-600/20">
                                <Download className="text-white" size={28} />
                            </div>
                            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 uppercase">Weekly Report</h2>
                            <p className="text-slate-400 text-sm font-medium">Category-wise revenue breakdown with sortable data</p>
                        </div>

                        {/* Week selector */}
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={() => setWeekOffset(prev => prev - 1)}
                                className="bg-white border border-slate-100 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                ← Previous
                            </button>
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-700">
                                    {getWeekRange(weekOffset).start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    {' → '}
                                    {getWeekRange(weekOffset).end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} weeks ago`}
                                </p>
                            </div>
                            <button
                                onClick={() => setWeekOffset(prev => Math.min(prev + 1, 0))}
                                disabled={weekOffset >= 0}
                                className="bg-white border border-slate-100 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30"
                            >
                                Next →
                            </button>
                        </div>

                        <button
                            onClick={exportWeeklyReport}
                            disabled={exportLoading}
                            className="btn-gradient w-full py-6 rounded-2xl flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest shadow-xl shadow-teal-600/20"
                        >
                            {exportLoading ? (
                                <><RefreshCw size={18} className="animate-spin" /> Generating...</>
                            ) : (
                                <><Download size={18} /> Export Weekly Report (CSV)</>
                            )}
                        </button>

                        <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                            Includes category aggregation • per-item breakdown • full order details
                        </p>
                    </div>
                )}
            </div>

            {/* Rejection Reason Modal */}
            <AnimatePresence>
                {rejectingOrder && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setRejectingOrder(null)}
                            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-6"
                        >
                            <div className="glass-card max-w-md w-full space-y-6">
                                <div className="text-center space-y-2">
                                    <div className="w-14 h-14 bg-red-500 rounded-2xl flex items-center justify-center mx-auto">
                                        <XCircle className="text-white" size={28} />
                                    </div>
                                    <h3 className="text-2xl font-extrabold tracking-tight text-slate-800 uppercase">Reject Order</h3>
                                    <p className="text-slate-400 text-sm">Table {rejectingOrder.table_number} • {rejectingOrder.customer_name}</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Reason (optional)</label>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="e.g. Item unavailable, Kitchen closed..."
                                        className="input-modern w-full h-24 text-sm resize-none"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setRejectingOrder(null)}
                                        className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => rejectOrder(rejectingOrder, rejectionReason)}
                                        className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                    >
                                        Confirm Reject
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

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
