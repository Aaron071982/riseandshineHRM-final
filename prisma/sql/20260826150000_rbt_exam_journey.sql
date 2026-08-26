DO $$ BEGIN
  CREATE TYPE "RbtExamFeeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RbtExamOutcome" AS ENUM ('PASSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "rbt_profiles"
  ADD COLUMN IF NOT EXISTS "rbtCertJourneySeenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rbtExamScheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rbtExamOutcome" "RbtExamOutcome",
  ADD COLUMN IF NOT EXISTS "rbtExamOutcomeAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "rbt_exam_fee_requests" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "status" "RbtExamFeeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "adminNote" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rbt_exam_fee_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rbt_exam_fee_requests_rbtProfileId_status_idx"
  ON "rbt_exam_fee_requests"("rbtProfileId", "status");
CREATE INDEX IF NOT EXISTS "rbt_exam_fee_requests_status_createdAt_idx"
  ON "rbt_exam_fee_requests"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "rbt_exam_fee_requests"
    ADD CONSTRAINT "rbt_exam_fee_requests_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
