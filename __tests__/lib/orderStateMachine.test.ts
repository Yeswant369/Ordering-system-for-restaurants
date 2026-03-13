import { VALID_TRANSITIONS, OrderStatus, STATUS_CONFIG } from '../../lib/types';

describe('Order State Machine', () => {
    describe('Valid transitions', () => {
        it('pending can only transition to accepted or rejected', () => {
            expect(VALID_TRANSITIONS.pending).toEqual(['accepted', 'rejected']);
        });

        it('accepted can transition to preparing or rejected', () => {
            expect(VALID_TRANSITIONS.accepted).toEqual(['preparing', 'rejected']);
        });

        it('rejected is a terminal state', () => {
            expect(VALID_TRANSITIONS.rejected).toEqual([]);
        });

        it('preparing can only transition to ready', () => {
            expect(VALID_TRANSITIONS.preparing).toEqual(['ready']);
        });

        it('ready can only transition to billed', () => {
            expect(VALID_TRANSITIONS.ready).toEqual(['billed']);
        });

        it('billed can transition to payment_submitted, cash_pending, or paid', () => {
            expect(VALID_TRANSITIONS.billed).toContain('payment_submitted');
            expect(VALID_TRANSITIONS.billed).toContain('cash_pending');
            expect(VALID_TRANSITIONS.billed).toContain('paid');
        });

        it('payment_submitted can only transition to paid', () => {
            expect(VALID_TRANSITIONS.payment_submitted).toEqual(['paid']);
        });

        it('cash_pending can only transition to paid', () => {
            expect(VALID_TRANSITIONS.cash_pending).toEqual(['paid']);
        });

        it('paid is a terminal state', () => {
            expect(VALID_TRANSITIONS.paid).toEqual([]);
        });

        it('cancelled is a terminal state', () => {
            expect(VALID_TRANSITIONS.cancelled).toEqual([]);
        });
    });

    describe('Transition validation helper', () => {
        function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
            return VALID_TRANSITIONS[from]?.includes(to) ?? false;
        }

        it('should allow pending → accepted', () => {
            expect(isValidTransition('pending', 'accepted')).toBe(true);
        });

        it('should NOT allow pending → paid (skipping steps)', () => {
            expect(isValidTransition('pending', 'paid')).toBe(false);
        });

        it('should NOT allow pending → billed (skipping steps)', () => {
            expect(isValidTransition('pending', 'billed')).toBe(false);
        });

        it('should NOT allow paid → pending (reverse)', () => {
            expect(isValidTransition('paid', 'pending')).toBe(false);
        });

        it('should allow billed → payment_submitted (customer claims UPI)', () => {
            expect(isValidTransition('billed', 'payment_submitted')).toBe(true);
        });

        it('should NOT allow customer to go directly from pending to paid', () => {
            expect(isValidTransition('pending', 'paid')).toBe(false);
        });

        it('should validate the full happy path: pending → accepted → preparing → ready → billed → paid', () => {
            expect(isValidTransition('pending', 'accepted')).toBe(true);
            expect(isValidTransition('accepted', 'preparing')).toBe(true);
            expect(isValidTransition('preparing', 'ready')).toBe(true);
            expect(isValidTransition('ready', 'billed')).toBe(true);
            expect(isValidTransition('billed', 'paid')).toBe(true);
        });
    });

    describe('Status configuration', () => {
        const allStatuses: OrderStatus[] = [
            'pending', 'accepted', 'rejected', 'preparing', 'ready',
            'billed', 'payment_submitted', 'cash_pending', 'paid', 'cancelled'
        ];

        it('should have config for every status', () => {
            for (const status of allStatuses) {
                expect(STATUS_CONFIG[status]).toBeDefined();
                expect(STATUS_CONFIG[status].label).toBeTruthy();
                expect(STATUS_CONFIG[status].color).toBeTruthy();
                expect(STATUS_CONFIG[status].customerMessage).toBeTruthy();
            }
        });

        it('should have valid Tailwind color classes', () => {
            for (const status of allStatuses) {
                expect(STATUS_CONFIG[status].color).toMatch(/^bg-/);
                expect(STATUS_CONFIG[status].textColor).toMatch(/^text-/);
                expect(STATUS_CONFIG[status].borderColor).toMatch(/^border-/);
            }
        });
    });
});
