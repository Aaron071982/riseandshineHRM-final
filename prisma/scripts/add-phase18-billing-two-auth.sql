-- Phase 18: Billing/Plutus merge + two-auth model (additive)
-- Safe to run on dev first.

ALTER TABLE "service_clients"
  ADD COLUMN IF NOT EXISTS "vobResult" TEXT;

ALTER TABLE "client_authorizations"
  ADD COLUMN IF NOT EXISTS "payerPlan" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "decisionDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "renderingProviderId" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "denialReason" TEXT,
  ADD COLUMN IF NOT EXISTS "denialClass" TEXT,
  ADD COLUMN IF NOT EXISTS "proofOfSubmissionDocId" TEXT,
  ADD COLUMN IF NOT EXISTS "payerCallLogRef" TEXT;

ALTER TABLE "client_authorization_lines"
  ADD COLUMN IF NOT EXISTS "authRequired" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "unitsRequested" INTEGER,
  ADD COLUMN IF NOT EXISTS "unitsApproved" INTEGER,
  ADD COLUMN IF NOT EXISTS "isUnderApproved" BOOLEAN DEFAULT false;

ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "cptCode" TEXT,
  ADD COLUMN IF NOT EXISTS "renderingProviderId" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "billabilityStatus" TEXT DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "billabilityReason" TEXT;

-- Backfill existing auth rows.
UPDATE "client_authorizations"
SET "payerPlan" = COALESCE(NULLIF("payerPlan", ''), "payerName")
WHERE "payerPlan" IS NULL OR "payerPlan" = '';

UPDATE "client_authorizations"
SET "submittedDate" = COALESCE("submittedDate", "requestedAt")
WHERE "submittedDate" IS NULL;

UPDATE "client_authorizations"
SET "decisionDate" = COALESCE("decisionDate", "approvedAt")
WHERE "decisionDate" IS NULL AND "approvedAt" IS NOT NULL;

UPDATE "client_authorization_lines"
SET
  "unitsRequested" = COALESCE("unitsRequested", "unitsAuthorized"),
  "unitsApproved" = COALESCE("unitsApproved", "unitsAuthorized"),
  "isUnderApproved" = COALESCE("unitsApproved", "unitsAuthorized") < COALESCE("unitsRequested", "unitsAuthorized")
WHERE "deletedAt" IS NULL;

UPDATE "rbt_schedule_assignments"
SET "cptCode" = COALESCE("cptCode", '97153')
WHERE "cptCode" IS NULL;
