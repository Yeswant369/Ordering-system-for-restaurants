-- ============================================================
-- PRODUCTION HOTFIX v4
-- End-to-end staff RPC + policy hardening for status propagation
-- ============================================================

-- 0) Ensure core schema pieces exist (idempotent)
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "total_amount" numeric;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "payment_mode" text;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "accepted_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "accepted_by" uuid REFERENCES auth.users(id);
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "rejected_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "ready_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "billed_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "payment_claimed_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "paid_at" timestamptz;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "paid_verified_by" uuid REFERENCES auth.users(id);

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

-- 1) RLS baseline policies (idempotent)
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_can_insert_orders" ON "public"."orders";
CREATE POLICY "anyone_can_insert_orders" ON "public"."orders"
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anyone_can_read_orders" ON "public"."orders";
CREATE POLICY "anyone_can_read_orders" ON "public"."orders"
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "only_staff_can_update_orders" ON "public"."orders";
CREATE POLICY "only_staff_can_update_orders" ON "public"."orders"
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id
            FROM "public"."staff_roles"
            WHERE is_active = true
        )
    );

ALTER TABLE "public"."staff_roles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_can_read_roles" ON "public"."staff_roles";
CREATE POLICY "staff_can_read_roles" ON "public"."staff_roles"
    FOR SELECT USING (true);

-- 2) Staff/customer lifecycle RPCs (idempotent)
CREATE OR REPLACE FUNCTION claim_payment(
    p_order_id uuid,
    p_payment_mode text
) RETURNS void AS $$
BEGIN
    UPDATE "public"."orders"
    SET
        status = CASE WHEN p_payment_mode = 'cash' THEN 'cash_pending' ELSE 'payment_submitted' END,
        payment_mode = p_payment_mode,
        payment_claimed_at = now()
    WHERE id = p_order_id
      AND status = 'billed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION accept_order_staff(
    p_order_id uuid,
    p_staff_id uuid
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'accepted', accepted_at = now(), accepted_by = p_staff_id
    WHERE id = p_order_id
      AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_order_staff(
    p_order_id uuid,
    p_staff_id uuid,
    p_reason text DEFAULT 'Rejected by staff'
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'rejected', rejected_at = now(), rejection_reason = p_reason
    WHERE id = p_order_id
      AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE OR REPLACE FUNCTION ready_order_staff(
    p_order_id uuid,
    p_staff_id uuid
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'ready', ready_at = now()
    WHERE id = p_order_id
      AND status = 'preparing';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_bill_staff(
    p_order_id uuid,
    p_staff_id uuid,
    p_total_amount numeric
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'billed', total_amount = p_total_amount, billed_at = now()
    WHERE id = p_order_id
      AND status = 'ready';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION confirm_payment_staff(
    p_order_id uuid,
    p_payment_mode text,
    p_staff_id uuid
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'paid', payment_mode = p_payment_mode, paid_at = now(), paid_verified_by = p_staff_id
    WHERE id = p_order_id
      AND status IN ('payment_submitted', 'cash_pending', 'billed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
