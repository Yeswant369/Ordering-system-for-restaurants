import { aggregateByCategory, generateCSV, getWeekRange, sortOrders, SortField } from '../../lib/exportUtils';
import { Order } from '../../lib/types';

// Helper: create a mock order
function createMockOrder(overrides: Partial<Order> = {}): Order {
    return {
        id: 'order-' + Math.random().toString(36).substr(2, 9),
        table_number: 1,
        customer_name: 'Test Customer',
        items: [
            { name: 'Paneer Butter Masala', price: 220, quantity: 2 },
            { name: 'Butter Naan', price: 40, quantity: 4 },
        ],
        category_items: [
            { name: 'Paneer Butter Masala', price: 220, quantity: 2, category: 'Signature Mains' },
            { name: 'Butter Naan', price: 40, quantity: 4, category: 'Sides' },
        ],
        status: 'paid',
        created_at: new Date().toISOString(),
        total_amount: 600,
        payment_mode: 'upi',
        ...overrides,
    };
}

describe('Export Utilities', () => {
    describe('aggregateByCategory', () => {
        it('should aggregate items by category', () => {
            const orders = [
                createMockOrder(),
                createMockOrder({
                    category_items: [
                        { name: 'Paneer Butter Masala', price: 220, quantity: 1, category: 'Signature Mains' },
                        { name: 'Veg Biryani', price: 180, quantity: 2, category: 'Rice & Bowls' },
                    ],
                }),
            ];

            const result = aggregateByCategory(orders);

            // Should have 3 entries: Paneer (aggregated), Naan, Biryani
            expect(result.length).toBe(3);

            // Check Paneer aggregation (2 + 1 = 3 total)
            const paneer = result.find(r => r.itemName === 'Paneer Butter Masala');
            expect(paneer).toBeDefined();
            expect(paneer!.totalQuantity).toBe(3);
            expect(paneer!.totalRevenue).toBe(220 * 3);
            expect(paneer!.category).toBe('Signature Mains');
        });

        it('should handle orders without category_items (fallback to items)', () => {
            const orders = [
                createMockOrder({
                    category_items: undefined,
                    items: [
                        { name: 'Kopico', price: 1, quantity: 5 },
                    ],
                }),
            ];

            const result = aggregateByCategory(orders);
            expect(result.length).toBe(1);
            expect(result[0].itemName).toBe('Kopico');
            expect(result[0].category).toBe('Uncategorized');
        });

        it('should return empty array for empty input', () => {
            expect(aggregateByCategory([])).toEqual([]);
        });

        it('should sort by category then item name', () => {
            const orders = [
                createMockOrder({
                    category_items: [
                        { name: 'Zucchini', price: 100, quantity: 1, category: 'Sides' },
                        { name: 'Apple Juice', price: 50, quantity: 1, category: 'Beverages' },
                    ],
                }),
            ];

            const result = aggregateByCategory(orders);
            // Beverages comes before Sides alphabetically
            expect(result[0].category).toBe('Beverages');
            expect(result[1].category).toBe('Sides');
        });
    });

    describe('sortOrders', () => {
        const orders = [
            createMockOrder({ created_at: '2026-03-10T10:00:00Z', table_number: 3, total_amount: 500 }),
            createMockOrder({ created_at: '2026-03-11T10:00:00Z', table_number: 1, total_amount: 800 }),
            createMockOrder({ created_at: '2026-03-09T10:00:00Z', table_number: 5, total_amount: 200 }),
        ];

        it('should sort by date ascending', () => {
            const sorted = sortOrders(orders, 'date', 'asc');
            expect(new Date(sorted[0].created_at).getTime()).toBeLessThan(new Date(sorted[1].created_at).getTime());
        });

        it('should sort by date descending', () => {
            const sorted = sortOrders(orders, 'date', 'desc');
            expect(new Date(sorted[0].created_at).getTime()).toBeGreaterThan(new Date(sorted[1].created_at).getTime());
        });

        it('should sort by table number', () => {
            const sorted = sortOrders(orders, 'table', 'asc');
            expect(sorted[0].table_number).toBe(1);
            expect(sorted[2].table_number).toBe(5);
        });

        it('should sort by amount', () => {
            const sorted = sortOrders(orders, 'amount', 'desc');
            expect(sorted[0].total_amount).toBe(800);
            expect(sorted[2].total_amount).toBe(200);
        });
    });

    describe('generateCSV', () => {
        it('should generate valid CSV content', () => {
            const csv = generateCSV({
                weekStart: '10/03/2026',
                weekEnd: '16/03/2026',
                totalOrders: 2,
                totalRevenue: 1200,
                categories: [
                    { category: 'Mains', itemName: 'Paneer', totalQuantity: 5, totalRevenue: 1100 },
                    { category: 'Sides', itemName: 'Naan', totalQuantity: 4, totalRevenue: 160 },
                ],
                orders: [createMockOrder()],
            });

            expect(csv).toContain('Weekly Report');
            expect(csv).toContain('Total Orders: 2');
            expect(csv).toContain('Total Revenue: ₹1200');
            expect(csv).toContain('CATEGORY-WISE SUMMARY');
            expect(csv).toContain('"Mains","Paneer",5,1100');
            expect(csv).toContain('ORDER DETAILS');
        });
    });

    describe('getWeekRange', () => {
        it('should return start and end dates for current week', () => {
            const { start, end } = getWeekRange(0);
            expect(start).toBeInstanceOf(Date);
            expect(end).toBeInstanceOf(Date);
            expect(end.getTime()).toBeGreaterThan(start.getTime());
        });

        it('should return previous week for offset -1', () => {
            const currentWeek = getWeekRange(0);
            const lastWeek = getWeekRange(-1);
            expect(lastWeek.start.getTime()).toBeLessThan(currentWeek.start.getTime());
        });

        it('should span a full 7-day week (Sunday to Saturday)', () => {
            const { start, end } = getWeekRange(0);
            // start is Sunday 00:00:00, end is Saturday 23:59:59
            expect(start.getDay()).toBe(0); // Sunday
            expect(end.getDay()).toBe(6);   // Saturday
            // Difference should be ~6.99 days (6 full days + 23:59:59)
            const diffMs = end.getTime() - start.getTime();
            expect(diffMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
            expect(diffMs).toBeLessThan(7 * 24 * 60 * 60 * 1000);
        });
    });
});
