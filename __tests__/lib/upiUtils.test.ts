import { buildUPIDeepLink, calculateTotal, getOwnerUPIId } from '../../lib/upiUtils';

describe('UPI Utilities', () => {
    describe('buildUPIDeepLink', () => {
        it('should build a valid UPI deep link with all required fields', () => {
            const uri = buildUPIDeepLink({
                pa: '8332884499@ybl',
                pn: 'Restaurant',
                tr: 'order-123',
                am: 450,
            });

            expect(uri).toContain('upi://pay?');
            expect(uri).toContain('pa=8332884499%40ybl'); // @ is encoded
            expect(uri).toContain('pn=Restaurant');
            expect(uri).toContain('tr=order-123');
            expect(uri).toContain('am=450.00');
            expect(uri).toContain('cu=INR');
        });

        it('should URL-encode special characters in payee name', () => {
            const uri = buildUPIDeepLink({
                pa: 'test@upi',
                pn: 'My Restaurant & Café',
                tr: 'order-456',
                am: 100,
            });

            // Special chars should be encoded
            expect(uri).not.toContain('&Café');
            expect(uri).toContain('pn=My+Restaurant');
        });

        it('should include merchant code when provided', () => {
            const uri = buildUPIDeepLink({
                pa: 'test@upi',
                pn: 'Restaurant',
                tr: 'order-789',
                am: 250,
                mc: '5812',
            });

            expect(uri).toContain('mc=5812');
        });

        it('should include transaction note when provided', () => {
            const uri = buildUPIDeepLink({
                pa: 'test@upi',
                pn: 'Restaurant',
                tr: 'order-101',
                tn: 'Table 5 - Rahul',
                am: 300,
            });

            expect(uri).toContain('tn=Table');
        });

        it('should format amount with 2 decimal places', () => {
            const uri = buildUPIDeepLink({
                pa: 'test@upi',
                pn: 'Test',
                tr: 'ord-1',
                am: 100,
            });

            expect(uri).toContain('am=100.00');
        });

        it('should handle zero amounts', () => {
            const uri = buildUPIDeepLink({
                pa: 'test@upi',
                pn: 'Test',
                tr: 'ord-0',
                am: 0,
            });

            expect(uri).toContain('am=0.00');
        });

        it('should default currency to INR', () => {
            const uri = buildUPIDeepLink({
                pa: 'test@upi',
                pn: 'Test',
                tr: 'ord-1',
                am: 100,
            });

            expect(uri).toContain('cu=INR');
        });

        it('should allow custom currency', () => {
            const uri = buildUPIDeepLink({
                pa: 'test@upi',
                pn: 'Test',
                tr: 'ord-1',
                am: 100,
                cu: 'USD',
            });

            expect(uri).toContain('cu=USD');
        });
    });

    describe('calculateTotal', () => {
        it('should calculate total for single item', () => {
            const total = calculateTotal([{ price: 220, quantity: 1 }]);
            expect(total).toBe(220);
        });

        it('should calculate total for multiple items', () => {
            const total = calculateTotal([
                { price: 220, quantity: 2 },
                { price: 180, quantity: 1 },
                { price: 40, quantity: 3 },
            ]);
            expect(total).toBe(220 * 2 + 180 + 40 * 3); // 440 + 180 + 120 = 740
        });

        it('should return 0 for empty list', () => {
            const total = calculateTotal([]);
            expect(total).toBe(0);
        });

        it('should handle large quantities', () => {
            const total = calculateTotal([{ price: 250, quantity: 100 }]);
            expect(total).toBe(25000);
        });
    });

    describe('getOwnerUPIId', () => {
        it('should return a UPI ID string', () => {
            const upiId = getOwnerUPIId();
            expect(typeof upiId).toBe('string');
            expect(upiId.length).toBeGreaterThan(0);
            expect(upiId).toContain('@');
        });
    });
});
