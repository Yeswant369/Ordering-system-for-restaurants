// ============================================================
// Shared Types for the Restaurant Ordering System
// ============================================================

// Order status state machine
export type OrderStatus =
    | 'pending'       // Customer placed order, awaiting staff acknowledgment
    | 'accepted'      // Staff accepted, kitchen notified
    | 'rejected'      // Staff rejected the order
    | 'preparing'     // Kitchen is preparing the order
    | 'ready'         // Food is ready for serving
    | 'billed'        // Bill has been generated and sent to customer
    | 'payment_submitted' // Customer claims payment made (NOT verified)
    | 'cash_pending'  // Customer requested cash payment
    | 'paid'          // Staff verified payment complete
    | 'cancelled';    // Order was cancelled

// Valid transitions map
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending: ['accepted', 'rejected'],
    accepted: ['preparing', 'rejected'],
    rejected: [],
    preparing: ['ready'],
    ready: ['billed'],
    billed: ['payment_submitted', 'cash_pending', 'paid'], // paid only by staff
    payment_submitted: ['paid'],
    cash_pending: ['paid'],
    paid: [],
    cancelled: [],
};

// Status display configuration
export const STATUS_CONFIG: Record<OrderStatus, {
    label: string;
    color: string;       // tailwind bg color
    textColor: string;   // tailwind text color
    borderColor: string;
    customerMessage: string;
    icon: string; // lucide icon name
}> = {
    pending: {
        label: 'Order Received',
        color: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        customerMessage: 'Your order has been received and is awaiting confirmation...',
        icon: 'Clock',
    },
    accepted: {
        label: 'Accepted',
        color: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        customerMessage: 'Your order has been accepted by the kitchen!',
        icon: 'CheckCircle2',
    },
    rejected: {
        label: 'Rejected',
        color: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        customerMessage: 'Sorry, your order could not be processed.',
        icon: 'XCircle',
    },
    preparing: {
        label: 'Preparing',
        color: 'bg-violet-50',
        textColor: 'text-violet-700',
        borderColor: 'border-violet-200',
        customerMessage: 'Your food is being prepared by our chefs!',
        icon: 'ChefHat',
    },
    ready: {
        label: 'Ready',
        color: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        customerMessage: 'Your order is ready! It will be served shortly.',
        icon: 'UtensilsCrossed',
    },
    billed: {
        label: 'Bill Sent',
        color: 'bg-orange-50',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200',
        customerMessage: 'Please complete your payment.',
        icon: 'Receipt',
    },
    payment_submitted: {
        label: 'Payment Claimed',
        color: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
        customerMessage: 'Payment submitted. Awaiting staff verification...',
        icon: 'Hourglass',
    },
    cash_pending: {
        label: 'Cash Pending',
        color: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
        customerMessage: 'Please hand over the cash to the staff.',
        icon: 'Banknote',
    },
    paid: {
        label: 'Paid',
        color: 'bg-teal-50',
        textColor: 'text-teal-700',
        borderColor: 'border-teal-200',
        customerMessage: 'Payment confirmed. Thank you for dining with us!',
        icon: 'PartyPopper',
    },
    cancelled: {
        label: 'Cancelled',
        color: 'bg-slate-50',
        textColor: 'text-slate-500',
        borderColor: 'border-slate-200',
        customerMessage: 'This order has been cancelled.',
        icon: 'Ban',
    },
};

export interface CartItemWithCategory {
    name: string;
    price: number;
    quantity: number;
    category: string;
}

export interface OrderItem {
    name: string;
    price: number;
    quantity: number;
}

export interface Order {
    id: string;
    table_number: number;
    customer_name: string;
    items: OrderItem[];
    category_items?: CartItemWithCategory[];
    status: OrderStatus;
    created_at: string;
    total_amount?: number;
    payment_mode?: string;
    idempotency_key?: string;
    customer_session_id?: string;
    accepted_at?: string;
    rejected_at?: string;
    ready_at?: string;
    billed_at?: string;
    payment_claimed_at?: string;
    paid_at?: string;
    accepted_by?: string;
    paid_verified_by?: string;
    rejection_reason?: string;
}

export interface MenuItem {
    id: number;
    name: string;
    price: number;
    category: string;
    description: string;
}
