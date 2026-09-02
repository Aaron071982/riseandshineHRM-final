-- Staffing departure / replacement flags (Part A)
-- Manual Supabase backup BEFORE applying on prod.
-- Adds needs_replacement fields on rbt_schedule_assignments and departing on rbt_profiles.

ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "needs_replacement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "replacement_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "expected_end_date" DATE,
  ADD COLUMN IF NOT EXISTS "flagged_by" TEXT,
  ADD COLUMN IF NOT EXISTS "flagged_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_needs_replacement_idx"
  ON "rbt_schedule_assignments"("needs_replacement", "resolved_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rbt_schedule_assignments_flagged_by_fkey'
  ) THEN
    ALTER TABLE "rbt_schedule_assignments"
      ADD CONSTRAINT "rbt_schedule_assignments_flagged_by_fkey"
      FOREIGN KEY ("flagged_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "rbt_profiles"
  ADD COLUMN IF NOT EXISTS "departing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_day" DATE,
  ADD COLUMN IF NOT EXISTS "departure_note" TEXT,
  ADD COLUMN IF NOT EXISTS "departure_flagged_by" TEXT,
  ADD COLUMN IF NOT EXISTS "departure_flagged_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rbt_profiles_departure_flagged_by_fkey'
  ) THEN
    ALTER TABLE "rbt_profiles"
      ADD CONSTRAINT "rbt_profiles_departure_flagged_by_fkey"
      FOREIGN KEY ("departure_flagged_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
