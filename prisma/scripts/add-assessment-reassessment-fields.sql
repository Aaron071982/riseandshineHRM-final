-- Reassessment support on the existing assessments table (additive, idempotent).
-- previousAssessmentId links a reassessment to the record it was cloned from.
-- reassessment holds the reassessment-only JSON section (reporting period, caregiver
-- training, instrument comparison, barriers, units requested, changes since last).
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS "previousAssessmentId" TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS "reassessment" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_previousAssessmentId_fkey'
  ) THEN
    ALTER TABLE assessments
      ADD CONSTRAINT "assessments_previousAssessmentId_fkey"
      FOREIGN KEY ("previousAssessmentId") REFERENCES assessments(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "assessments_previousAssessmentId_idx" ON assessments ("previousAssessmentId");
