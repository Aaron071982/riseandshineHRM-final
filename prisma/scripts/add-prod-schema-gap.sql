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
  ADD COLUMN IF NOT EXISTS "ccRecipients" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentsJson" JSONB;

ALTER TABLE "client_requirements"
  ADD COLUMN IF NOT EXISTS "fileName" TEXT,
  ADD COLUMN IF NOT EXISTS "fileContentType" TEXT,
  ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER;

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

-- ── Team tasks (v1 collaborative task system) ───────────────────────────────

DO $$ BEGIN
  CREATE TYPE "TeamTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TeamTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TeamTaskExtensionStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "team_tasks" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TeamTaskStatus" NOT NULL DEFAULT 'TODO',
  "priority" "TeamTaskPriority" NOT NULL DEFAULT 'NORMAL',
  "dueAt" TIMESTAMP(3),
  "assignedToUserId" TEXT,
  "assignedDept" "ClientOwnerDept",
  "createdByUserId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "completedByUserId" TEXT,
  "blockedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  CONSTRAINT "team_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "team_task_subtasks" (
  "id" TEXT NOT NULL,
  "teamTaskId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "team_task_subtasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "team_task_comments" (
  "id" TEXT NOT NULL,
  "teamTaskId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "mentionsJson" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "team_task_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "team_task_extension_requests" (
  "id" TEXT NOT NULL,
  "teamTaskId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "requestedDueAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "status" "TeamTaskExtensionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_task_extension_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "team_task_activities" (
  "id" TEXT NOT NULL,
  "teamTaskId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_task_activities_pkey" PRIMARY KEY ("id")
);

-- CRM role-based training / responsibilities
CREATE TABLE IF NOT EXISTS "crm_training_modules" (
  "id" TEXT NOT NULL,
  "crmRole" "CrmRole" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "goalStatement" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_training_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_training_modules_crmRole_key"
  ON "crm_training_modules"("crmRole");

CREATE TABLE IF NOT EXISTS "crm_training_steps" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "stepNumber" INTEGER NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "icon" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_training_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_training_steps_slug_key"
  ON "crm_training_steps"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "crm_training_steps_moduleId_stepNumber_key"
  ON "crm_training_steps"("moduleId", "stepNumber");

CREATE INDEX IF NOT EXISTS "crm_training_steps_moduleId_idx"
  ON "crm_training_steps"("moduleId");

CREATE TABLE IF NOT EXISTS "crm_training_step_completions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_training_step_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_training_step_completions_userId_stepId_key"
  ON "crm_training_step_completions"("userId", "stepId");

CREATE INDEX IF NOT EXISTS "crm_training_step_completions_userId_idx"
  ON "crm_training_step_completions"("userId");

DO $$ BEGIN
  ALTER TABLE "crm_training_steps"
    ADD CONSTRAINT "crm_training_steps_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "crm_training_modules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "crm_training_step_completions"
    ADD CONSTRAINT "crm_training_step_completions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "crm_training_step_completions"
    ADD CONSTRAINT "crm_training_step_completions_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "crm_training_steps"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- Optional non-blocking drift (Prisma schema alignment; omit if you prefer):
-- ALTER TABLE "client_consents" ALTER COLUMN "updatedAt" DROP DEFAULT;
-- ALTER TABLE "client_referral_checks" ALTER COLUMN "updatedAt" DROP DEFAULT;
