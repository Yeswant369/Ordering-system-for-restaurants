// ============================================================
// UPI Deep Link Utilities — Production-Grade
// ============================================================

interface UPIParams {
    /** Payee VPA (UPI ID) */
    pa: string;
    /** Payee Name */
    pn: string;
    /** Transaction Reference ID */
    tr: string;
    /** Transaction Note */
    tn?: string;
    /** Amount */
    am: number;
    /** Currency (default INR) */
    cu?: string;
    /** Merchant Code (5812 for restaurants) */
    mc?: string;
}

/**
 * Builds a properly URL-encoded UPI deep link.
 * Uses URLSearchParams for correct encoding of all fields.
 */
export function buildUPIDeepLink(params: UPIParams): string {
    const searchParams = new URLSearchParams();

    searchParams.set('pa', params.pa);
    searchParams.set('pn', params.pn);
    searchParams.set('tr', params.tr);

    if (params.tn) {
        searchParams.set('tn', params.tn);
    }

    // Format amount with 2 decimal places
    searchParams.set('am', params.am.toFixed(2));
    searchParams.set('cu', params.cu || 'INR');

    if (params.mc) {
        searchParams.set('mc', params.mc);
    }

    return `upi://pay?${searchParams.toString()}`;
}

/**
 * Get the UPI ID from environment or fallback.
 * In production, this should come from server-side config.
 */
export function getOwnerUPIId(): string {
    return process.env.NEXT_PUBLIC_OWNER_UPI_ID || '8332884499@ybl';
}

/**
 * Get the restaurant name from environment or fallback.
 */
export function getRestaurantName(): string {
    return process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant';
}

/**
 * Formats a UPI ID for safe display (partial masking optional).
 */
export function formatUPIForDisplay(upiId: string): string {
    return upiId;
}

/**
 * Calculate total from cart items.
 */
export function calculateTotal(items: { price: number; quantity: number }[]): number {
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
}
