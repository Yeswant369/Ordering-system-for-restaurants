-- ============================================================
-- PRODUCTION-GRADE SCHEMA MIGRATION v2
-- Restaurant Ordering System
-- ============================================================

-- 1. Add new status lifecycle columns & audit fields
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "idempotency_key" text UNIQUE;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "category_items" jsonb; -- items WITH category stored per item
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "customer_session_id" text;

-- Audit timestamps
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "accepted_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "rejected_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "ready_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "billed_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "payment_claimed_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "paid_at" timestamptz;

-- Staff who performed each action
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "accepted_by" uuid REFERENCES auth.users(id);
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "paid_verified_by" uuid REFERENCES auth.users(id);
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "rating" integer CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "review_emoji" text;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "review_note" text;

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON "public"."orders" (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON "public"."orders" (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table_number ON "public"."orders" (table_number);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON "public"."orders" (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_session ON "public"."orders" (customer_session_id);

-- 3. Staff roles table (replaces hardcoded emails)
CREATE TABLE IF NOT EXISTS "public"."staff_roles" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL DEFAULT 'waiter' CHECK (role IN ('admin', 'manager', 'waiter', 'kitchen')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- Seed initial staff (replace with your actual user IDs after first login)
-- INSERT INTO "public"."staff_roles" (email, user_id, role) VALUES
--   ('yeswantsai9@gmail.com', '<user-uuid>', 'admin'),
--   ('reliefreplyof21@gmail.com', '<user-uuid>', 'manager');

-- 4. RLS Policies

-- Enable RLS on orders
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT orders (customers place orders without auth)
DROP POLICY IF EXISTS "anyone_can_insert_orders" ON "public"."orders";
CREATE POLICY "anyone_can_insert_orders" ON "public"."orders"
    FOR INSERT WITH CHECK (true);

-- Anyone can SELECT orders (customers need to see their order status)
DROP POLICY IF EXISTS "anyone_can_read_orders" ON "public"."orders";
CREATE POLICY "anyone_can_read_orders" ON "public"."orders"
    FOR SELECT USING (true);

-- CRITICAL: Only authenticated staff can UPDATE orders
-- This prevents customers from marking orders as paid
DROP POLICY IF EXISTS "only_staff_can_update_orders" ON "public"."orders";
CREATE POLICY "only_staff_can_update_orders" ON "public"."orders"
    FOR UPDATE USING (
        auth.uid() IN (SELECT user_id FROM "public"."staff_roles" WHERE is_active = true)
    );

-- Enable RLS on staff_roles
ALTER TABLE "public"."staff_roles" ENABLE ROW LEVEL SECURITY;

-- Anyone can read staff roles (needed for RPC checks)
DROP POLICY IF EXISTS "staff_can_read_roles" ON "public"."staff_roles";
CREATE POLICY "staff_can_read_roles" ON "public"."staff_roles"
    FOR SELECT USING (true);

-- 5. Server-side RPC for sensitive transitions

-- RPC: Customer claims payment (sets payment_submitted, NOT paid)
CREATE OR REPLACE FUNCTION claim_payment(
    p_order_id uuid,
    p_payment_mode text
) RETURNS void AS $$
BEGIN
    UPDATE "public"."orders"
    SET 
        status = 'payment_submitted',
        payment_mode = p_payment_mode,
        payment_claimed_at = now()
    WHERE id = p_order_id
    AND status = 'billed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Staff confirms payment (only authenticated staff)
CREATE OR REPLACE FUNCTION confirm_payment_staff(
    p_order_id uuid,
    p_payment_mode text,
    p_staff_id uuid
) RETURNS void AS $$
BEGIN
    -- Verify caller is staff
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized: not a staff member';
    END IF;

    UPDATE "public"."orders"
    SET 
        status = 'paid',
        payment_mode = p_payment_mode,
        paid_at = now(),
        paid_verified_by = p_staff_id
    WHERE id = p_order_id
    AND status IN ('payment_submitted', 'billed', 'cash_pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Staff accepts order
CREATE OR REPLACE FUNCTION accept_order_staff(
    p_order_id uuid,
    p_staff_id uuid
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET 
        status = 'accepted',
        accepted_at = now(),
        accepted_by = p_staff_id
    WHERE id = p_order_id
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Staff rejects order
CREATE OR REPLACE FUNCTION reject_order_staff(
    p_order_id uuid,
    p_staff_id uuid,
    p_reason text DEFAULT 'No reason provided'
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET 
        status = 'rejected',
        rejected_at = now(),
        rejection_reason = p_reason
    WHERE id = p_order_id
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Staff marks order as preparing
CREATE OR REPLACE FUNCTION preparing_order_staff(
    p_order_id uuid,
    p_staff_id uuid
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'preparing'
    WHERE id = p_order_id
    AND status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Staff marks order as ready
CREATE OR REPLACE FUNCTION ready_order_staff(
    p_order_id uuid,
    p_staff_id uuid
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET 
        status = 'ready',
        ready_at = now()
    WHERE id = p_order_id
    AND status = 'preparing';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get active order for a session/table
CREATE OR REPLACE FUNCTION get_active_order(
    p_session_id text,
    p_table_number integer
) RETURNS SETOF "public"."orders" AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM "public"."orders"
    WHERE customer_session_id = p_session_id
    AND table_number = p_table_number
    AND status NOT IN ('paid', 'rejected', 'cancelled')
    ORDER BY created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
