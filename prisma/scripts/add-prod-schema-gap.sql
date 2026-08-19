-- Prod schema gap closure: prisma/schema.prisma → riseandshine-hrm-prod
-- Generated via: prisma migrate diff --from-url $PROD_DATABASE_URL --to-schema-datamodel prisma/schema.prisma
-- Audit date: 2026-08-19
--
-- BEFORE RUN: manual Supabase backup (Dashboard → Database → Backups)
-- Run: psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/add-prod-schema-gap.sql
--
-- Idempotent: safe to re-run. Additive only (no DROP/TRUNCATE/DELETE).
--
-- Already on prod (NOT in this script — applied earlier):
--   Phase 13 soft-delete columns + deletedAt indexes on all family tables
--   client_claims table, reviewStatus, authType, attestation columns, etc.

BEGIN;

-- ── Enums (missing entirely on prod) ───────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AuthDenialClass" AS ENUM ('CLERICAL', 'CLINICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SessionBillabilityStatus" AS ENUM ('COVERED', 'NOT_COVERED', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Enum values (CommTemplate — PG 15+ IF NOT EXISTS) ────────────────────────

ALTER TYPE "CommTemplate" ADD VALUE IF NOT EXISTS 'WELCOME';
ALTER TYPE "CommTemplate" ADD VALUE IF NOT EXISTS 'MEET_AND_GREET';
ALTER TYPE "CommTemplate" ADD VALUE IF NOT EXISTS 'CASE_COORDINATION_FORM';

-- ── Columns ──────────────────────────────────────────────────────────────────

ALTER TABLE "service_clients"
  ADD COLUMN IF NOT EXISTS "vobResult" TEXT,
  ADD COLUMN IF NOT EXISTS "staffingNeedsMoreHours" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "staffingHighPriority" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "client_authorizations"
  ADD COLUMN IF NOT EXISTS "decisionDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "denialClass" "AuthDenialClass",
  ADD COLUMN IF NOT EXISTS "denialReason" TEXT,
  ADD COLUMN IF NOT EXISTS "payerCallLogRef" TEXT,
  ADD COLUMN IF NOT EXISTS "payerPlan" TEXT,
  ADD COLUMN IF NOT EXISTS "proofOfSubmissionDocId" TEXT,
  ADD COLUMN IF NOT EXISTS "renderingProviderId" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedDate" TIMESTAMP(3);

ALTER TABLE "client_authorization_lines"
  ADD COLUMN IF NOT EXISTS "authRequired" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isUnderApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "unitsApproved" INTEGER,
  ADD COLUMN IF NOT EXISTS "unitsRequested" INTEGER;

ALTER TABLE "client_communications"
  ADD COLUMN IF NOT EXISTS "ccRecipients" TEXT;

ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "billabilityReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cptCode" TEXT,
  ADD COLUMN IF NOT EXISTS "renderingProviderId" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceLocation" TEXT;

-- billabilityStatus depends on SessionBillabilityStatus enum (created above)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rbt_schedule_assignments'
      AND column_name = 'billabilityStatus'
  ) THEN
    ALTER TABLE "rbt_schedule_assignments"
      ADD COLUMN "billabilityStatus" "SessionBillabilityStatus" NOT NULL DEFAULT 'UNKNOWN';
  END IF;
END $$;

-- ── Foreign keys (missing on prod; columns already exist) ────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_clients_deletedByUserId_fkey') THEN
    ALTER TABLE "service_clients"
      ADD CONSTRAINT "service_clients_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_requirements_attestedByUserId_fkey') THEN
    ALTER TABLE "client_requirements"
      ADD CONSTRAINT "client_requirements_attestedByUserId_fkey"
      FOREIGN KEY ("attestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_requirements_deletedByUserId_fkey') THEN
    ALTER TABLE "client_requirements"
      ADD CONSTRAINT "client_requirements_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_consents_staffWitnessUserId_fkey') THEN
    ALTER TABLE "client_consents"
      ADD CONSTRAINT "client_consents_staffWitnessUserId_fkey"
      FOREIGN KEY ("staffWitnessUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_referral_checks_updatedByUserId_fkey') THEN
    ALTER TABLE "client_referral_checks"
      ADD CONSTRAINT "client_referral_checks_updatedByUserId_fkey"
      FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_authorizations_deletedByUserId_fkey') THEN
    ALTER TABLE "client_authorizations"
      ADD CONSTRAINT "client_authorizations_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_authorization_lines_deletedByUserId_fkey') THEN
    ALTER TABLE "client_authorization_lines"
      ADD CONSTRAINT "client_authorization_lines_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_tasks_deletedByUserId_fkey') THEN
    ALTER TABLE "client_tasks"
      ADD CONSTRAINT "client_tasks_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_communications_deletedByUserId_fkey') THEN
    ALTER TABLE "client_communications"
      ADD CONSTRAINT "client_communications_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_alerts_deletedByUserId_fkey') THEN
    ALTER TABLE "client_alerts"
      ADD CONSTRAINT "client_alerts_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rbt_schedule_assignments_deletedByUserId_fkey') THEN
    ALTER TABLE "rbt_schedule_assignments"
      ADD CONSTRAINT "rbt_schedule_assignments_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_client_bt_assignments_deletedByUserId_fkey') THEN
    ALTER TABLE "service_client_bt_assignments"
      ADD CONSTRAINT "service_client_bt_assignments_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_client_notes_deletedByUserId_fkey') THEN
    ALTER TABLE "service_client_notes"
      ADD CONSTRAINT "service_client_notes_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- Optional non-blocking drift (Prisma schema alignment; omit if you prefer):
-- ALTER TABLE "client_consents" ALTER COLUMN "updatedAt" DROP DEFAULT;
-- ALTER TABLE "client_referral_checks" ALTER COLUMN "updatedAt" DROP DEFAULT;
