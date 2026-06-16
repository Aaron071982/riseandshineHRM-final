-- Post-hire actively working fields on rbt_profiles (run once on existing PostgreSQL DBs)
DO $$ BEGIN
  CREATE TYPE "PostHireStage" AS ENUM ('MATCHING', 'ACTIVE_DELIVERY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "postHireStage" "PostHireStage";
ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "activeWorkingSince" TIMESTAMP(3);
ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "activeWorkingManualOverride" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "rbt_profiles_postHireStage_idx" ON "rbt_profiles"("postHireStage");

UPDATE "rbt_profiles"
SET "postHireStage" = 'MATCHING'
WHERE status = 'HIRED' AND "postHireStage" IS NULL;
