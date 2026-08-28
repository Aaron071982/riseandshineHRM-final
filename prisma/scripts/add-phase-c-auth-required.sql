-- Phase C: plan-level PA requirement from VOB (additive, default TRUE).
-- Take a manual Supabase backup before applying to prod (DB_CHANGE_POLICY.md).

ALTER TABLE "service_clients"
  ADD COLUMN IF NOT EXISTS "authRequired" BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN "service_clients"."authRequired" IS
  'Plan-level prior-auth requirement from VOB. Default true (assume PA required). Never derived from payerType.';
