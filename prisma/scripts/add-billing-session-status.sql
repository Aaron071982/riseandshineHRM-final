-- Status-aware payroll: session status + configurable payable statuses per cycle
-- Run in Supabase SQL editor.

ALTER TABLE "billing_sessions"
  ADD COLUMN IF NOT EXISTS "sessionStatus" TEXT;

ALTER TABLE "billing_cycles"
  ADD COLUMN IF NOT EXISTS "payableStatuses" JSONB
  DEFAULT '["completed","ready_to_bill"]'::jsonb;

-- Backfill sessionStatus from rawStatus where possible
UPDATE "billing_sessions"
SET "sessionStatus" = CASE
  WHEN LOWER(TRIM(COALESCE("rawStatus", ''))) = 'completed' THEN 'completed'
  WHEN LOWER(TRIM(COALESCE("rawStatus", ''))) = 'ready to bill' THEN 'ready_to_bill'
  WHEN LOWER(TRIM(COALESCE("rawStatus", ''))) = 'in progress' THEN 'in_progress'
  WHEN LOWER(TRIM(COALESCE("rawStatus", ''))) = 'incomplete' THEN 'incomplete'
  WHEN LOWER(TRIM(COALESCE("rawStatus", ''))) = 'scheduled' THEN 'scheduled'
  WHEN LOWER(TRIM(COALESCE("rawStatus", ''))) IN ('cancelled', 'canceled') THEN 'cancelled'
  WHEN LOWER(TRIM(COALESCE("rawStatus", ''))) = 'deleted' THEN 'deleted'
  ELSE NULL
END
WHERE "sessionStatus" IS NULL AND "rawStatus" IS NOT NULL;

UPDATE "billing_cycles"
SET "payableStatuses" = '["completed","ready_to_bill"]'::jsonb
WHERE "payableStatuses" IS NULL;
