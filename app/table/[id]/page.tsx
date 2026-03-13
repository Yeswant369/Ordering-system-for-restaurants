'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
    Plus, Minus, ShoppingCart, CheckCircle2, Loader2, ArrowRight, Star, X,
    ShoppingBag, QrCode, Banknote, ShieldCheck, Download, ChefHat, Clock,
    XCircle, UtensilsCrossed, RefreshCw, Phone, Copy, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

import { OrderStatus, STATUS_CONFIG, CartItemWithCategory } from '@/lib/types';
import { buildUPIDeepLink, getOwnerUPIId, getRestaurantName, calculateTotal } from '@/lib/upiUtils';
import {
    MENU, MENU_CATEGORIES, STORAGE_KEYS,
    ORDER_TIMEOUT_INITIAL, ORDER_TIMEOUT_FINAL, POLL_INTERVAL,
    generateIdempotencyKey, generateSessionId
} from '@/lib/constants';

// ============================================================
// Helper: Persistent storage with SSR safety
// ============================================================
function safeGet(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(key: string) {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ============================================================
// Status Icon Component
// ============================================================
function StatusIcon({ status, size = 40 }: { status: OrderStatus; size?: number }) {
    const iconMap: Record<string, React.ReactNode> = {
        pending: <Clock size={size} />,
        accepted: <CheckCircle2 size={size} />,
        rejected: <XCircle size={size} />,
        preparing: <ChefHat size={size} />,
        ready: <UtensilsCrossed size={size} />,
        billed: <QrCode size={size} />,
        payment_submitted: <Loader2 size={size} className="animate-spin" />,
        cash_pending: <Banknote size={size} />,
        paid: <CheckCircle2 size={size} />,
        cancelled: <XCircle size={size} />,
    };
    return <>{iconMap[status] || <Clock size={size} />}</>;
}

// ============================================================
// Main Table Page Component
// ============================================================
export default function TablePage() {
    const supabase = createClient();
    const params = useParams();
    const tableId = params.id as string;

    // Core state
    const [customerName, setCustomerName] = useState('');
    const [isNameEntered, setIsNameEntered] = useState(false);
    const [cart, setCart] = useState<Record<number, number>>({});
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [orderStatus, setOrderStatus] = useState<OrderStatus | 'idle'>('idle');
    const [orderId, setOrderId] = useState<string | null>(null);
    const [finalTotal, setFinalTotal] = useState<number>(0);
    const [showCartDrawer, setShowCartDrawer] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [orderItems, setOrderItems] = useState<CartItemWithCategory[]>([]);

    // Review state
    const [rating, setRating] = useState<number>(0);
    const [reviewEmoji, setReviewEmoji] = useState<string>('');
    const [reviewNote, setReviewNote] = useState<string>('');
    const [isReviewSubmitted, setIsReviewSubmitted] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // Timeout / fallback state
    const [showStillWorking, setShowStillWorking] = useState(false);
    const [showContactStaff, setShowContactStaff] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [upiCopied, setUpiCopied] = useState(false);

    // Refs for cleanup
    const timeoutRef1 = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef2 = useRef<NodeJS.Timeout | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    // ─── Session recovery on mount ───────────────────────────
    useEffect(() => {
        const savedSessionId = safeGet(STORAGE_KEYS.SESSION_ID);
        if (savedSessionId) {
            setSessionId(savedSessionId);
        } else {
            const newSessionId = generateSessionId();
            setSessionId(newSessionId);
            safeSet(STORAGE_KEYS.SESSION_ID, newSessionId);
        }

        // Recover saved state
        const savedOrderId = safeGet(STORAGE_KEYS.ORDER_ID);
        const savedTableId = safeGet(STORAGE_KEYS.TABLE_ID);
        const savedStatus = safeGet(STORAGE_KEYS.ORDER_STATUS);
        const savedName = safeGet(STORAGE_KEYS.CUSTOMER_NAME);
        const savedTotal = safeGet(STORAGE_KEYS.FINAL_TOTAL);
        const savedItems = safeGet(STORAGE_KEYS.ORDER_ITEMS);

        if (savedOrderId && savedTableId === tableId && savedStatus && savedStatus !== 'paid' && savedStatus !== 'rejected' && savedStatus !== 'cancelled') {
            setOrderId(savedOrderId);
            setOrderStatus(savedStatus as OrderStatus);
            if (savedName) {
                setCustomerName(savedName);
                setIsNameEntered(true);
            }
            if (savedTotal) setFinalTotal(parseFloat(savedTotal));
            if (savedItems) {
                try { setOrderItems(JSON.parse(savedItems)); } catch { /* ignore */ }
            }

            // Fetch latest status from server to sync
            fetchOrderStatus(savedOrderId);
        }
    }, [tableId]);

    // ─── Fetch latest order status (recovery + polling fallback) ─
    const fetchOrderStatus = useCallback(async (oid: string) => {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', oid)
            .single();

        if (!error && data) {
            setOrderStatus(data.status as OrderStatus);
            if (data.total_amount) setFinalTotal(data.total_amount);
            if (data.rejection_reason) setRejectionReason(data.rejection_reason);

            // Persist
            safeSet(STORAGE_KEYS.ORDER_STATUS, data.status);
            if (data.total_amount) safeSet(STORAGE_KEYS.FINAL_TOTAL, data.total_amount.toString());
        }
    }, [supabase]);

    // ─── Realtime subscription ───────────────────────────────
    useEffect(() => {
        if (!orderId) return;

        // Clean up previous channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
            .channel(`order-${orderId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
                (payload) => {
                    const updated = payload.new;
                    const newStatus = updated.status as OrderStatus;

                    setOrderStatus(newStatus);
                    safeSet(STORAGE_KEYS.ORDER_STATUS, newStatus);

                    if (updated.total_amount) {
                        setFinalTotal(updated.total_amount);
                        safeSet(STORAGE_KEYS.FINAL_TOTAL, updated.total_amount.toString());
                    }
                    if (updated.rejection_reason) {
                        setRejectionReason(updated.rejection_reason);
                    }

                    // Clear timeout indicators on any status change
                    setShowStillWorking(false);
                    setShowContactStaff(false);
                    clearTimeouts();
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    // Start background polling if realtime fails
                    startPolling(orderId);
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [orderId]);

    // ─── Timeout guardrails ──────────────────────────────────
    useEffect(() => {
        if (orderStatus === 'pending') {
            // 30s: show "still working"
            timeoutRef1.current = setTimeout(() => {
                setShowStillWorking(true);
            }, ORDER_TIMEOUT_INITIAL);

            // 60s: show "contact staff"
            timeoutRef2.current = setTimeout(() => {
                setShowContactStaff(true);
            }, ORDER_TIMEOUT_FINAL);
        } else {
            clearTimeouts();
            setShowStillWorking(false);
            setShowContactStaff(false);
        }

        return () => clearTimeouts();
    }, [orderStatus]);

    function clearTimeouts() {
        if (timeoutRef1.current) clearTimeout(timeoutRef1.current);
        if (timeoutRef2.current) clearTimeout(timeoutRef2.current);
    }

    // ─── Background polling fallback ─────────────────────────
    function startPolling(oid: string) {
        if (isPolling) return;
        setIsPolling(true);
        pollIntervalRef.current = setInterval(() => {
            fetchOrderStatus(oid);
        }, POLL_INTERVAL);
    }

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    // Stop polling when order reaches terminal state
    useEffect(() => {
        if (['paid', 'rejected', 'cancelled'].includes(orderStatus)) {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                setIsPolling(false);
            }
        }
    }, [orderStatus]);

    // ─── Cart operations ─────────────────────────────────────
    const addToCart = (id: number) => setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));

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
    const totalPrice = MENU.reduce((acc, item) => acc + (cart[item.id] || 0) * item.price, 0);

    // ─── Place order (with idempotency + category storage) ───
    const placeOrder = async () => {
        if (!customerName || cartItemsCount === 0) return;

        setIsPlacingOrder(true);

        // Build items WITH category
        const categoryItems: CartItemWithCategory[] = MENU
            .filter(item => cart[item.id])
            .map(item => ({
                name: item.name,
                price: item.price,
                quantity: cart[item.id],
                category: item.category,
            }));

        // Legacy items (without category) for backward compat
        const legacyItems = categoryItems.map(({ name, price, quantity }) => ({ name, price, quantity }));

        const idempotencyKey = generateIdempotencyKey(tableId, sessionId);

        const { data, error } = await supabase
            .from('orders')
            .insert({
                table_number: parseInt(tableId),
                customer_name: customerName,
                items: legacyItems,
                category_items: categoryItems,
                status: 'pending',
                idempotency_key: idempotencyKey,
                customer_session_id: sessionId,
            })
            .select('id')
            .single();

        setIsPlacingOrder(false);

        if (!error && data) {
            setOrderId(data.id);
            setOrderStatus('pending');
            setOrderItems(categoryItems);
            setCart({});
            setShowCartDrawer(false);

            // Persist to localStorage
            safeSet(STORAGE_KEYS.ORDER_ID, data.id);
            safeSet(STORAGE_KEYS.ORDER_STATUS, 'pending');
            safeSet(STORAGE_KEYS.TABLE_ID, tableId);
            safeSet(STORAGE_KEYS.CUSTOMER_NAME, customerName);
            safeSet(STORAGE_KEYS.ORDER_ITEMS, JSON.stringify(categoryItems));
        } else {
            console.error("Failed to place order:", error);
            // Check if idempotency conflict (duplicate)
            if (error?.code === '23505') {
                alert('This order was already submitted. Refreshing status...');
                // Try to recover the existing order
                const { data: existing } = await supabase
                    .from('orders')
                    .select('id, status')
                    .eq('idempotency_key', idempotencyKey)
                    .single();
                if (existing) {
                    setOrderId(existing.id);
                    setOrderStatus(existing.status as OrderStatus);
                }
            }
        }
    };

    // ─── Submit payment claim (NOT final — staff must verify) ─
    const submitPaymentClaim = async (mode: 'cash' | 'upi') => {
        if (!orderId) return;
        setIsPlacingOrder(true);

        // Customer can only claim payment, not finalize it
        const newStatus = mode === 'cash' ? 'cash_pending' : 'payment_submitted';

        const { error } = await supabase
            .rpc('claim_payment', {
                p_order_id: orderId,
                p_payment_mode: mode,
            });

        setIsPlacingOrder(false);

        if (!error) {
            setOrderStatus(newStatus);
            safeSet(STORAGE_KEYS.ORDER_STATUS, newStatus);
        } else {
            console.error("Failed to submit payment claim:", error);
            // Fallback: direct update for backward compat (if RPC not deployed yet)
            const { error: fallbackError } = await supabase
                .from('orders')
                .update({ status: newStatus, payment_mode: mode, payment_claimed_at: new Date().toISOString() })
                .eq('id', orderId);

            if (!fallbackError) {
                setOrderStatus(newStatus);
                safeSet(STORAGE_KEYS.ORDER_STATUS, newStatus);
            }
        }
    };

    // ─── Retry / refresh ─────────────────────────────────────
    const retryCheck = async () => {
        if (orderId) {
            setShowStillWorking(false);
            setShowContactStaff(false);
            await fetchOrderStatus(orderId);
        }
    };

    // ─── Copy UPI ID to clipboard ────────────────────────────
    const copyUPIId = async () => {
        try {
            await navigator.clipboard.writeText(getOwnerUPIId());
            setUpiCopied(true);
            setTimeout(() => setUpiCopied(false), 2000);
        } catch {
            // Fallback
            const input = document.createElement('input');
            input.value = getOwnerUPIId();
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setUpiCopied(true);
            setTimeout(() => setUpiCopied(false), 2000);
        }
    };

    // ─── Download bill ───────────────────────────────────────
    const downloadBill = () => {
        const items = orderItems.length > 0 ? orderItems : [];
        const itemsText = items.map(item =>
            `  ${item.name} (${item.quantity}x) — ₹${item.price * item.quantity}`
        ).join('\n');

        const receiptText = `
=================================
       IN-ROOM DINING RECEIPT
=================================
Table: ${tableId}
Guest: ${customerName}
Order ID: ${orderId}
Date: ${new Date().toLocaleDateString('en-IN')}

ITEMS:
${itemsText || '  Items not available in current session'}

---------------------------------
TOTAL PAID: ₹${finalTotal}
---------------------------------
Thank you for dining with us!
=================================
        `.trim();

        const blob = new Blob([receiptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bill_Table${tableId}_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ─── Submit Review ───────────────────────────────────────
    const submitReview = async () => {
        if (!orderId || rating === 0) return;
        setIsSubmittingReview(true);

        const { error } = await supabase
            .from('orders')
            .update({
                rating,
                review_emoji: reviewEmoji,
                review_note: reviewNote
            })
            .eq('id', orderId);

        setIsSubmittingReview(false);
        if (!error) {
            setIsReviewSubmitted(true);
        } else {
            console.error("Error submitting review:", error);
        }
    };

    // ─── Clear session (start fresh) ─────────────────────────
    const clearSession = () => {
        Object.values(STORAGE_KEYS).forEach(key => safeRemove(key));
        setOrderStatus('idle');
        setOrderId(null);
        setFinalTotal(0);
        setOrderItems([]);
        setShowStillWorking(false);
        setShowContactStaff(false);
        setRejectionReason('');
    };

    // ════════════════════════════════════════════════════════════
    // RENDER: Name Entry
    // ════════════════════════════════════════════════════════════
    if (!isNameEntered) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-teal-100/50">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card w-full max-w-md space-y-10"
                >
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-teal-600/20">
                            <ShoppingBag className="text-white" size={32} />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 uppercase">In-Room Dining</h1>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                            Table {tableId} • Authentication Node
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Your Identity</label>
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && customerName.trim() && setIsNameEntered(true)}
                                className="input-modern w-full"
                                id="customer-name-input"
                            />
                        </div>

                        <button
                            onClick={() => {
                                if (customerName.trim()) {
                                    setIsNameEntered(true);
                                    safeSet(STORAGE_KEYS.CUSTOMER_NAME, customerName.trim());
                                }
                            }}
                            disabled={!customerName.trim()}
                            className="btn-gradient w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-sm disabled:opacity-50 uppercase tracking-widest"
                            id="start-order-btn"
                        >
                            Initialize Node <ArrowRight size={18} />
                        </button>
                    </div>

                    <div className="pt-8 text-center text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">
                        Authorized Interface v4.02
                    </div>
                </motion.div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════
    // RENDER: Active order status screens
    // ════════════════════════════════════════════════════════════
    if (orderStatus !== 'idle') {
        const statusConfig = STATUS_CONFIG[orderStatus as OrderStatus];

        // ── Pending with timeout guardrails ──
        if (orderStatus === 'pending') {
            return (
                <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-teal-100/50">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card text-center max-w-sm space-y-6">
                        <div className="w-20 h-20 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-teal-500/20">
                            <CheckCircle2 size={40} />
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight uppercase">Order Received</h1>
                        <p className="text-slate-500 font-medium text-sm">
                            {showContactStaff
                                ? 'This is taking longer than expected. Please contact the staff directly.'
                                : showStillWorking
                                    ? 'Still working on your order... The kitchen is busy!'
                                    : 'Your order is being processed. The staff will accept it shortly.'}
                        </p>

                        <div className="flex justify-center">
                            <Loader2 className="animate-spin text-teal-500" size={32} />
                        </div>

                        {/* Timeout guardrails */}
                        <AnimatePresence>
                            {showStillWorking && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-3 pt-4"
                                >
                                    <button
                                        onClick={retryCheck}
                                        className="w-full bg-white border-2 border-teal-200 text-teal-600 py-3 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-bold hover:bg-teal-50 transition-colors"
                                    >
                                        <RefreshCw size={14} /> Refresh Status
                                    </button>

                                    {showContactStaff && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                                            <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                                            <p className="text-xs text-amber-700 font-medium text-left">
                                                If you have been waiting too long, please contact a staff member directly.
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            );
        }

        // ── Accepted / Preparing / Ready ──
        if (['accepted', 'preparing', 'ready'].includes(orderStatus)) {
            const colors: Record<string, string> = {
                accepted: 'bg-blue-500',
                preparing: 'bg-violet-500',
                ready: 'bg-emerald-500',
            };
            return (
                <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-teal-100/50">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="glass-card text-center max-w-sm space-y-6"
                    >
                        <div className={`w-20 h-20 ${colors[orderStatus]} text-white rounded-full flex items-center justify-center mx-auto shadow-xl`}>
                            <StatusIcon status={orderStatus as OrderStatus} />
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight uppercase">
                            {statusConfig?.label || orderStatus}
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">
                            {statusConfig?.customerMessage}
                        </p>

                        {orderStatus !== 'ready' && (
                            <div className="flex justify-center pt-2">
                                <Loader2 className="animate-spin text-teal-500" size={24} />
                            </div>
                        )}

                        {orderStatus === 'ready' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm font-bold">
                                🎉 Your food is ready and will be served to Table {tableId} shortly!
                            </div>
                        )}

                        <button
                            onClick={retryCheck}
                            className="text-teal-600 font-bold uppercase tracking-widest text-[10px] hover:text-teal-700 transition-colors py-2 flex items-center justify-center gap-2 mx-auto"
                        >
                            <RefreshCw size={12} /> Refresh
                        </button>
                    </motion.div>
                </div>
            );
        }

        // ── Rejected ──
        if (orderStatus === 'rejected') {
            return (
                <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-teal-100/50">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card text-center max-w-sm space-y-6">
                        <div className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-red-500/20">
                            <XCircle size={40} />
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight uppercase">Order Rejected</h1>
                        <p className="text-slate-500 font-medium text-sm">
                            {rejectionReason || 'Sorry, your order could not be processed. Please try again or contact staff.'}
                        </p>
                        <button
                            onClick={clearSession}
                            className="btn-gradient w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-widest font-bold"
                        >
                            Place New Order <ArrowRight size={16} />
                        </button>
                    </motion.div>
                </div>
            );
        }

        // ── Billed — Payment screen ──
        if (orderStatus === 'billed') {
            const upiUri = buildUPIDeepLink({
                pa: getOwnerUPIId(),
                pn: getRestaurantName(),
                tr: orderId || '',
                tn: `Table ${tableId} - ${customerName}`,
                am: finalTotal,
                mc: '5812',
            });

            return (
                <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-teal-100/50">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card w-full max-w-md p-8 border border-white">
                        <div className="text-center space-y-4 mb-10">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-slate-900/20">
                                <QrCode className="text-white" size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 uppercase">Final Bill</h1>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Please complete your payment</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 text-center space-y-2">
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Amount Due</p>
                            <p className="text-5xl font-black text-teal-600 tabular-nums tracking-tighter">₹{finalTotal}</p>
                        </div>

                        {/* QR Code */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8 flex flex-col items-center">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Scan to Pay via UPI</p>
                            <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm">
                                <QRCode value={upiUri} size={200} className="w-full h-auto" />
                            </div>
                            {/* Copy UPI ID fallback */}
                            <button
                                onClick={copyUPIId}
                                className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                {upiCopied ? (
                                    <><CheckCircle2 size={12} className="text-teal-500" /> Copied!</>
                                ) : (
                                    <><Copy size={12} /> Copy UPI ID: <span className="text-slate-800 tracking-normal ml-1">{getOwnerUPIId()}</span></>
                                )}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* UPI Deep Link */}
                            <a
                                href={upiUri}
                                className="w-full btn-gradient py-5 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] font-bold shadow-xl shadow-teal-600/20 block"
                                id="upi-pay-btn"
                            >
                                Open UPI App to Pay <ShieldCheck size={18} />
                            </a>

                            {/* UPI Claim (marks as payment_submitted, NOT paid) */}
                            <button
                                onClick={() => submitPaymentClaim('upi')}
                                disabled={isPlacingOrder}
                                className="w-full bg-emerald-600 text-white py-5 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                                id="upi-done-btn"
                            >
                                {isPlacingOrder ? <Loader2 className="animate-spin" /> : <>I&apos;ve Paid via UPI <CheckCircle2 size={18} /></>}
                            </button>

                            {/* Cash option */}
                            <button
                                onClick={() => submitPaymentClaim('cash')}
                                disabled={isPlacingOrder}
                                className="w-full bg-slate-800 text-white py-5 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] font-bold hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-900/20"
                                id="cash-pay-btn"
                            >
                                {isPlacingOrder ? <Loader2 className="animate-spin" /> : <>Pay with Cash <Banknote size={18} /></>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            );
        }

        // ── Payment Submitted / Cash Pending (waiting for staff verification) ──
        if (orderStatus === 'payment_submitted' || orderStatus === 'cash_pending') {
            return (
                <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-teal-100/50">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card text-center max-w-sm space-y-6">
                        <div className="w-20 h-20 bg-yellow-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-yellow-500/20">
                            {orderStatus === 'cash_pending' ? <Banknote size={40} /> : <Clock size={40} />}
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight uppercase">
                            {orderStatus === 'cash_pending' ? 'Cash Payment' : 'Verifying Payment'}
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">
                            {orderStatus === 'cash_pending'
                                ? 'Please hand over the cash to the staff. Your payment will be confirmed shortly...'
                                : 'Your UPI payment claim has been submitted. Staff will verify it shortly...'}
                        </p>
                        <div className="flex justify-center">
                            <Loader2 className="animate-spin text-yellow-500" size={32} />
                        </div>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                            Staff verification required
                        </p>
                    </motion.div>
                </div>
            );
        }

        // ── Paid — success! ──
        if (orderStatus === 'paid') {
            return (
                <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-teal-100/50">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card text-center max-w-sm space-y-6">
                        <div className="w-20 h-20 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-teal-500/20">
                            <CheckCircle2 size={40} />
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight uppercase">Payment Complete</h1>
                        <p className="text-slate-500 font-medium text-sm">Thank you for dining with us! Your payment has been verified successfully.</p>
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={downloadBill}
                                className="w-full bg-slate-800 text-white py-4 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-900/20"
                                id="download-bill-btn"
                            >
                                Download Bill <Download size={16} />
                            </button>
                            <button
                                onClick={clearSession}
                                className="text-teal-600 font-bold uppercase tracking-widest text-[10px] hover:text-teal-700 transition-colors py-2"
                                id="new-order-btn"
                            >
                                Start New Order
                            </button>
                        </div>

                        <AnimatePresence>
                            {!isReviewSubmitted ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6"
                                >
                                    <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">How was your experience?</h3>
                                    
                                    {/* Star Rating */}
                                    <div className="flex justify-center gap-2">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setRating(s)}
                                                className={`transition-all ${rating >= s ? 'text-yellow-400 scale-110' : 'text-slate-300'}`}
                                            >
                                                <Star size={32} fill={rating >= s ? 'currentColor' : 'none'} />
                                            </button>
                                        ))}
                                    </div>

                                    {/* Emoji Feedback */}
                                    <div className="flex justify-center gap-4">
                                        {['😋', '❤️', '👌', '⚡', '🤩'].map((emoji) => (
                                            <button
                                                key={emoji}
                                                onClick={() => setReviewEmoji(emoji === reviewEmoji ? '' : emoji)}
                                                className={`text-2xl p-2 rounded-xl transition-all ${reviewEmoji === emoji ? 'bg-white shadow-md scale-125 border border-teal-100' : 'opacity-50 grayscale hover:grayscale-0'}`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Optional Note */}
                                    <textarea
                                        value={reviewNote}
                                        onChange={(e) => setReviewNote(e.target.value)}
                                        placeholder="Any additional feedback? (Optional)"
                                        className="input-modern w-full h-20 text-sm resize-none py-3"
                                    />

                                    <button
                                        onClick={submitReview}
                                        disabled={rating === 0 || isSubmittingReview}
                                        className="w-full bg-teal-600 text-white py-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-teal-700 transition-all"
                                    >
                                        {isSubmittingReview ? <Loader2 className="animate-spin" size={16} /> : 'Submit Feedback'}
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="mt-8 p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-center space-y-2"
                                >
                                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2 text-white">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <h3 className="text-emerald-800 font-bold uppercase tracking-tight">Feedback Received!</h3>
                                    <p className="text-emerald-600 text-xs font-medium">Thank you for helping us improve.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            );
        }
    }

    // ════════════════════════════════════════════════════════════
    // RENDER: Menu & Cart (idle state)
    // ════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen pb-40">
            <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white p-6">
                <div className="max-w-2xl mx-auto flex justify-between items-center">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 uppercase">Service Node</h2>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-600">Table {tableId} • Guest: {customerName}</p>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowCartDrawer(true)}
                        className="relative bg-white shadow-xl shadow-teal-900/5 p-4 rounded-2xl text-slate-700 hover:text-teal-600 border border-slate-50"
                        id="open-cart-btn"
                    >
                        <ShoppingCart size={22} />
                        <AnimatePresence>
                            {cartItemsCount > 0 && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    className="absolute -top-2 -right-2 bg-teal-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-lg shadow-teal-600/30"
                                >
                                    {cartItemsCount}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-6 space-y-12 mt-8">
                {MENU_CATEGORIES.map((category) => (
                    <section key={category} className="space-y-8">
                        <div className="flex items-center gap-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-50">{category}</h3>
                            <div className="h-px flex-1 bg-slate-200/50" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {MENU.filter(item => item.category === category).map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    className="glass-card border border-white p-6 flex flex-col justify-between h-full group"
                                >
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-slate-800 text-lg uppercase tracking-tight group-hover:text-teal-600 transition-colors leading-tight">{item.name}</h4>
                                            {item.id === 1 && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                                        </div>
                                        <p className="text-slate-400 text-[11px] font-medium leading-relaxed italic">{item.description}</p>
                                    </div>

                                    <div className="mt-8 flex items-center justify-between gap-4">
                                        <span className="text-2xl font-extrabold text-slate-800 tabular-nums">₹{item.price}</span>
                                        <div className="flex items-center gap-2">
                                            {cart[item.id] ? (
                                                <div className="flex items-center bg-teal-50 rounded-xl p-1 border border-teal-100">
                                                    <button onClick={() => removeFromCart(item.id)} className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-lg transition-all text-teal-600">
                                                        <Minus size={16} strokeWidth={3} />
                                                    </button>
                                                    <span className="w-6 text-center font-bold text-slate-700 tabular-nums text-sm">
                                                        {cart[item.id]}
                                                    </span>
                                                    <button onClick={() => addToCart(item.id)} className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-lg transition-all text-teal-600">
                                                        <Plus size={16} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => addToCart(item.id)}
                                                    className="bg-white text-teal-600 w-11 h-11 flex items-center justify-center rounded-2xl shadow-lg shadow-teal-900/5 border border-slate-50 hover:bg-teal-600 hover:text-white transition-all transform active:scale-90"
                                                >
                                                    <Plus size={22} strokeWidth={3} />
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

            {/* Slide-out Cart Drawer */}
            <AnimatePresence>
                {showCartDrawer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCartDrawer(false)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
                        >
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-extrabold tracking-tight text-slate-800 uppercase">Selection Review</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-600 italic">Table {tableId} • Authorized Nodes</p>
                                </div>
                                <button
                                    onClick={() => setShowCartDrawer(false)}
                                    className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                {MENU.filter(item => cart[item.id]).length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-200 space-y-4">
                                        <ShoppingBag size={64} strokeWidth={1} />
                                        <p className="font-bold uppercase tracking-widest text-[10px]">Registry Empty</p>
                                    </div>
                                ) : (
                                    MENU.filter(item => cart[item.id]).map(item => (
                                        <div key={item.id} className="flex justify-between items-center group">
                                            <div className="space-y-1">
                                                <h5 className="font-bold text-slate-800 uppercase tracking-tight text-sm">{item.name}</h5>
                                                <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase italic">{item.category} • ₹{item.price}</p>
                                            </div>
                                            <div className="flex items-center gap-4 bg-teal-50 rounded-xl p-1 border border-teal-100">
                                                <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-teal-600">
                                                    <Minus size={14} strokeWidth={3} />
                                                </button>
                                                <span className="w-5 text-center font-bold text-slate-700 tabular-nums text-xs">
                                                    {cart[item.id]}
                                                </span>
                                                <button onClick={() => addToCart(item.id)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-teal-600">
                                                    <Plus size={14} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-8">
                                <div className="flex justify-between items-end">
                                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 leading-none">Total Valuation</span>
                                    <span className="text-3xl font-extrabold text-teal-600 tracking-tight tabular-nums leading-none">₹{totalPrice}</span>
                                </div>
                                <button
                                    onClick={placeOrder}
                                    disabled={isPlacingOrder || cartItemsCount === 0}
                                    className="btn-gradient w-full py-6 rounded-2xl flex items-center justify-center gap-4 text-xs font-bold uppercase tracking-[0.2em] shadow-xl shadow-teal-600/20"
                                    id="place-order-btn"
                                >
                                    {isPlacingOrder ? <Loader2 className="animate-spin" /> : <>Send Transmission <ArrowRight size={18} /></>}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Floating Cart Summary */}
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
                            id="floating-cart-btn"
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
