// ============================================================
// CSV/Export Utilities for Weekly Reports
// ============================================================

import { Order, CartItemWithCategory } from './types';

export interface CategoryAggregate {
    category: string;
    itemName: string;
    totalQuantity: number;
    totalRevenue: number;
}

export interface WeeklyReportData {
    weekStart: string;
    weekEnd: string;
    totalOrders: number;
    totalRevenue: number;
    categories: CategoryAggregate[];
    orders: Order[];
}

/**
 * Aggregate paid orders by category → item → qty → revenue
 */
export function aggregateByCategory(orders: Order[]): CategoryAggregate[] {
    const map = new Map<string, CategoryAggregate>();

    for (const order of orders) {
        const items = order.category_items || order.items;
        for (const item of items) {
            const category = ('category' in item && typeof item.category === 'string' && item.category) ? item.category : 'Uncategorized';
            const key = `${category}::${item.name}`;

            if (map.has(key)) {
                const existing = map.get(key)!;
                existing.totalQuantity += item.quantity;
                existing.totalRevenue += item.price * item.quantity;
            } else {
                map.set(key, {
                    category,
                    itemName: item.name,
                    totalQuantity: item.quantity,
                    totalRevenue: item.price * item.quantity,
                });
            }
        }
    }

    // Sort by category, then by item name
    return Array.from(map.values()).sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.itemName.localeCompare(b.itemName);
    });
}

export type SortField = 'date' | 'table' | 'amount' | 'category' | 'itemCount';
export type SortDirection = 'asc' | 'desc';

/**
 * Sort orders by a given field
 */
export function sortOrders(orders: Order[], field: SortField, direction: SortDirection): Order[] {
    const sorted = [...orders].sort((a, b) => {
        switch (field) {
            case 'date':
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            case 'table':
                return a.table_number - b.table_number;
            case 'amount':
                return (a.total_amount || 0) - (b.total_amount || 0);
            case 'itemCount':
                return a.items.reduce((s, i) => s + i.quantity, 0) - b.items.reduce((s, i) => s + i.quantity, 0);
            default:
                return 0;
        }
    });

    return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Generate CSV content from aggregated data + raw orders
 */
export function generateCSV(report: WeeklyReportData): string {
    const lines: string[] = [];

    // Header
    lines.push(`Weekly Report: ${report.weekStart} to ${report.weekEnd}`);
    lines.push(`Total Orders: ${report.totalOrders}`);
    lines.push(`Total Revenue: ₹${report.totalRevenue}`);
    lines.push('');

    // Category-wise summary
    lines.push('--- CATEGORY-WISE SUMMARY ---');
    lines.push('Category,Item Name,Total Quantity,Total Revenue (₹)');
    for (const cat of report.categories) {
        lines.push(`"${cat.category}","${cat.itemName}",${cat.totalQuantity},${cat.totalRevenue}`);
    }
    lines.push('');

    // Per-order details
    lines.push('--- ORDER DETAILS ---');
    lines.push('Order ID,Date,Time,Table,Customer,Items,Total (₹),Payment Mode,Status');
    for (const order of report.orders) {
        const date = new Date(order.created_at);
        const dateStr = date.toLocaleDateString('en-IN');
        const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const itemsSummary = order.items.map(i => `${i.name}(${i.quantity})`).join('; ');
        lines.push(
            `"${order.id}","${dateStr}","${timeStr}",${order.table_number},"${order.customer_name}","${itemsSummary}",${order.total_amount || 0},"${order.payment_mode || 'N/A'}","${order.status}"`
        );
    }

    return lines.join('\n');
}

/**
 * Trigger file download in the browser
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv') {
    const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8` }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Get date range for a given week offset (0 = current week, -1 = last week, etc.)
 */
export function getWeekRange(weekOffset: number = 0): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek + (weekOffset * 7));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}
