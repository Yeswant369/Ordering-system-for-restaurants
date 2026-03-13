// ============================================================
// Menu & App Constants
// ============================================================

import { MenuItem } from './types';

// Normalized Menu with categories — single source of truth
export const MENU: MenuItem[] = [
    { id: 1, name: 'Paneer Butter Masala', price: 220, category: 'Signature Mains', description: 'Cottage cheese in vibrant tomato velvet gravy.' },
    { id: 2, name: 'Veg Biryani', price: 180, category: 'Rice & Bowls', description: 'Basmati rice with garden fresh vegetables.' },
    { id: 3, name: 'Chicken Biryani', price: 250, category: 'Rice & Bowls', description: 'Classic hyderabadi style slow cooked chicken.' },
    { id: 4, name: 'Butter Naan', price: 40, category: 'Sides', description: 'Freshly baked tandoori bread with butter.' },
    { id: 5, name: 'Kopico', price: 1, category: 'Beverages', description: 'Chilled 330ml classic refreshment.' },
];

// All unique categories from the menu
export const MENU_CATEGORIES = Array.from(new Set(MENU.map(i => i.category)));

// Timeouts and intervals (in milliseconds)
export const ORDER_TIMEOUT_INITIAL = 30000;  // 30s before "still working" message
export const ORDER_TIMEOUT_FINAL = 60000;    // 60s before showing contact staff
export const POLL_INTERVAL = 12000;          // 12s background polling interval

// Session storage keys
export const STORAGE_KEYS = {
    ORDER_ID: 'restaurant_active_order_id',
    ORDER_STATUS: 'restaurant_active_order_status',
    TABLE_ID: 'restaurant_active_table_id',
    CUSTOMER_NAME: 'restaurant_customer_name',
    SESSION_ID: 'restaurant_session_id',
    CART: 'restaurant_cart',
    FINAL_TOTAL: 'restaurant_final_total',
    ORDER_ITEMS: 'restaurant_order_items',
} as const;

/**
 * Generate a unique idempotency key for an order.
 * Combines table, session, and timestamp to prevent duplicates.
 */
export function generateIdempotencyKey(tableId: string, sessionId: string): string {
    return `${tableId}_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique session ID for a customer visit.
 */
export function generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
