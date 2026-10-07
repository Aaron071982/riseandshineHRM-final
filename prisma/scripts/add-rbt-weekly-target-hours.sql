-- Optional per-therapist weekly capacity target used by the Schedule "Constellation" view.
-- Nullable: null means "not set" (the view falls back to the applicant's preferred hours, then 40).
ALTER TABLE rbt_profiles ADD COLUMN IF NOT EXISTS weekly_target_hours DOUBLE PRECISION;

ALTER TABLE rbt_profiles DROP CONSTRAINT IF EXISTS rbt_profiles_weekly_target_hours_range;
ALTER TABLE rbt_profiles
  ADD CONSTRAINT rbt_profiles_weekly_target_hours_range
  CHECK (weekly_target_hours IS NULL OR (weekly_target_hours > 0 AND weekly_target_hours <= 80));
