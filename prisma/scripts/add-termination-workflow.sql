-- Termination / offboarding workflow tables (run once on Supabase / Postgres).

DO $$ BEGIN
  CREATE TYPE "TerminationReason" AS ENUM (
    'PERFORMANCE', 'CONDUCT', 'ATTENDANCE', 'POLICY_VIOLATION',
    'RESTRUCTURING', 'END_OF_ASSIGNMENT', 'VOLUNTARY', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TerminationStatus" AS ENUM ('INITIATED', 'PENDING_TASKS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OffboardingTaskType" AS ENUM (
    'DISABLE_HRM_ACCESS', 'REVOKE_PHI_EHR_ACCESS', 'DISABLE_EMAIL_SSO',
    'COLLECT_PROPERTY', 'REASSIGN_CLIENTS', 'NOTIFY_SUPERVISOR',
    'REMOVE_FROM_ROSTER', 'CONFIRM_OPEN_NOTES', 'ISSUE_195_6_NOTICE',
    'ISSUE_IA_12_3', 'TRIGGER_COBRA', 'PROCESS_FINAL_PAY', 'FILE_DOCUMENTS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "terminations" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "status" "TerminationStatus" NOT NULL DEFAULT 'PENDING_TASKS',
  "reason" "TerminationReason" NOT NULL,
  "reasonNarrative" TEXT,
  "decisionMakerId" TEXT NOT NULL,
  "decisionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "terminationDate" TIMESTAMP(3) NOT NULL,
  "lastDayWorked" TIMESTAMP(3) NOT NULL,
  "benefitsEndDate" TIMESTAMP(3) NOT NULL,
  "finalPayDate" TIMESTAMP(3) NOT NULL,
  "noticeDeadline" TIMESTAMP(3) NOT NULL,
  "noticeIssuedAt" TIMESTAMP(3),
  "counselConsulted" BOOLEAN NOT NULL DEFAULT false,
  "reasonDocumented" BOOLEAN NOT NULL DEFAULT false,
  "consistencyChecked" BOOLEAN NOT NULL DEFAULT false,
  "redFlagPresent" BOOLEAN NOT NULL DEFAULT false,
  "contractChecked" BOOLEAN NOT NULL DEFAULT false,
  "regularWages" TEXT,
  "overtimeOwed" TEXT,
  "commissionsOwed" TEXT,
  "ptoPayout" TEXT,
  "deductions" TEXT,
  "netFinalPay" TEXT,
  "otherBenefitName" TEXT,
  "otherBenefitEndDate" TIMESTAMP(3),
  "ehrSystemName" TEXT,
  "propertyList" TEXT,
  "coveragePlan" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "terminations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "terminations_rbtProfileId_key" ON "terminations"("rbtProfileId");
CREATE INDEX IF NOT EXISTS "terminations_status_noticeDeadline_idx" ON "terminations"("status", "noticeDeadline");

DO $$ BEGIN
  ALTER TABLE "terminations"
    ADD CONSTRAINT "terminations_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "terminations"
    ADD CONSTRAINT "terminations_decisionMakerId_fkey"
    FOREIGN KEY ("decisionMakerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "offboarding_tasks" (
  "id" TEXT NOT NULL,
  "terminationId" TEXT NOT NULL,
  "type" "OffboardingTaskType" NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "offboarding_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "offboarding_tasks_terminationId_completed_idx"
  ON "offboarding_tasks"("terminationId", "completed");

DO $$ BEGIN
  ALTER TABLE "offboarding_tasks"
    ADD CONSTRAINT "offboarding_tasks_terminationId_fkey"
    FOREIGN KEY ("terminationId") REFERENCES "terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "termination_documents" (
  "id" TEXT NOT NULL,
  "terminationId" TEXT NOT NULL,
  "docType" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "contentHtml" TEXT,
  "fileName" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "termination_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "termination_documents_terminationId_docType_idx"
  ON "termination_documents"("terminationId", "docType");

DO $$ BEGIN
  ALTER TABLE "termination_documents"
    ADD CONSTRAINT "termination_documents_terminationId_fkey"
    FOREIGN KEY ("terminationId") REFERENCES "terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
