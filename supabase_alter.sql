ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "payment_mode" text;
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "total_amount" numeric;
