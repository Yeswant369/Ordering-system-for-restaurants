-- ============================================================
-- PRODUCTION HOTFIX v5
-- Fail loudly on invalid/no-op state transitions
-- ============================================================

CREATE OR REPLACE FUNCTION accept_order_staff(
    p_order_id uuid,
    p_staff_id uuid
) RETURNS void AS $$
DECLARE
    updated_count integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'accepted', accepted_at = now(), accepted_by = p_staff_id
    WHERE id = p_order_id
      AND status = 'pending';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN
        RAISE EXCEPTION 'Invalid transition: order must be pending before accept';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_order_staff(
    p_order_id uuid,
    p_staff_id uuid,
    p_reason text DEFAULT 'Rejected by staff'
) RETURNS void AS $$
DECLARE
    updated_count integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'rejected', rejected_at = now(), rejection_reason = p_reason
    WHERE id = p_order_id
      AND status = 'pending';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN
        RAISE EXCEPTION 'Invalid transition: order must be pending before reject';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION preparing_order_staff(
    p_order_id uuid,
    p_staff_id uuid
) RETURNS void AS $$
DECLARE
    updated_count integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'preparing'
    WHERE id = p_order_id
      AND status = 'accepted';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN
        RAISE EXCEPTION 'Invalid transition: order must be accepted before preparing';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ready_order_staff(
    p_order_id uuid,
    p_staff_id uuid
) RETURNS void AS $$
DECLARE
    updated_count integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'ready', ready_at = now()
    WHERE id = p_order_id
      AND status = 'preparing';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN
        RAISE EXCEPTION 'Invalid transition: order must be preparing before ready';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_bill_staff(
    p_order_id uuid,
    p_staff_id uuid,
    p_total_amount numeric
) RETURNS void AS $$
DECLARE
    updated_count integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'billed', total_amount = p_total_amount, billed_at = now()
    WHERE id = p_order_id
      AND status = 'ready';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN
        RAISE EXCEPTION 'Invalid transition: order must be ready before billed';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION confirm_payment_staff(
    p_order_id uuid,
    p_payment_mode text,
    p_staff_id uuid
) RETURNS void AS $$
DECLARE
    updated_count integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."staff_roles" WHERE user_id = p_staff_id AND is_active = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET status = 'paid', payment_mode = p_payment_mode, paid_at = now(), paid_verified_by = p_staff_id
    WHERE id = p_order_id
      AND status IN ('payment_submitted', 'cash_pending', 'billed');

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN
        RAISE EXCEPTION 'Invalid transition: order must be billed/payment_submitted/cash_pending before paid';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
