import { generateIdempotencyKey, generateSessionId, MENU, MENU_CATEGORIES, STORAGE_KEYS } from '../../lib/constants';

describe('Constants & Helpers', () => {
    describe('MENU', () => {
        it('should have at least 1 menu item', () => {
            expect(MENU.length).toBeGreaterThan(0);
        });

        it('every item should have required fields', () => {
            for (const item of MENU) {
                expect(item.id).toBeDefined();
                expect(typeof item.name).toBe('string');
                expect(item.name.length).toBeGreaterThan(0);
                expect(typeof item.price).toBe('number');
                expect(item.price).toBeGreaterThanOrEqual(0);
                expect(typeof item.category).toBe('string');
                expect(item.category.length).toBeGreaterThan(0);
                expect(typeof item.description).toBe('string');
            }
        });

        it('should have unique IDs', () => {
            const ids = MENU.map(i => i.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    describe('MENU_CATEGORIES', () => {
        it('should derive categories from menu', () => {
            expect(MENU_CATEGORIES.length).toBeGreaterThan(0);
            // Every category should appear in at least one menu item
            for (const cat of MENU_CATEGORIES) {
                expect(MENU.some(item => item.category === cat)).toBe(true);
            }
        });

        it('should have no duplicates', () => {
            const unique = new Set(MENU_CATEGORIES);
            expect(unique.size).toBe(MENU_CATEGORIES.length);
        });
    });

    describe('generateIdempotencyKey', () => {
        it('should generate a non-empty string', () => {
            const key = generateIdempotencyKey('1', 'session-abc');
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
        });

        it('should include table and session IDs', () => {
            const key = generateIdempotencyKey('5', 'sess_123');
            expect(key).toContain('5');
            expect(key).toContain('sess_123');
        });

        it('should generate unique keys on consecutive calls', () => {
            const key1 = generateIdempotencyKey('1', 'ses1');
            const key2 = generateIdempotencyKey('1', 'ses1');
            expect(key1).not.toBe(key2);
        });
    });

    describe('generateSessionId', () => {
        it('should start with sess_ prefix', () => {
            const id = generateSessionId();
            expect(id.startsWith('sess_')).toBe(true);
        });

        it('should generate unique session IDs', () => {
            const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
            expect(ids.size).toBe(100);
        });
    });

    describe('STORAGE_KEYS', () => {
        it('should have all required keys', () => {
            expect(STORAGE_KEYS.ORDER_ID).toBeDefined();
            expect(STORAGE_KEYS.ORDER_STATUS).toBeDefined();
            expect(STORAGE_KEYS.TABLE_ID).toBeDefined();
            expect(STORAGE_KEYS.CUSTOMER_NAME).toBeDefined();
            expect(STORAGE_KEYS.SESSION_ID).toBeDefined();
        });

        it('all values should be unique', () => {
            const values = Object.values(STORAGE_KEYS);
            const unique = new Set(values);
            expect(unique.size).toBe(values.length);
        });
    });
});
