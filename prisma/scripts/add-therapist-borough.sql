-- RBT/therapist borough for schedule export grouping.
ALTER TABLE "therapist" ADD COLUMN IF NOT EXISTS "borough" TEXT;
CREATE INDEX IF NOT EXISTS "therapist_borough_idx" ON "therapist"("borough");
