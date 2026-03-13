-- ============================================================
-- PRODUCTION HOTFIX v3
-- Ensure billing transition is staff-verified server-side
-- ============================================================

-- RPC: Staff generates bill (moves ready -> billed with total)
CREATE OR REPLACE FUNCTION generate_bill_staff(
    p_order_id uuid,
    p_staff_id uuid,
    p_total_amount numeric
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."staff_roles"
        WHERE user_id = p_staff_id
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE "public"."orders"
    SET
        status = 'billed',
        total_amount = p_total_amount,
        billed_at = now()
    WHERE id = p_order_id
      AND status = 'ready';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
