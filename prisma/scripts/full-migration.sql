-- ============================================================
-- Rise and Shine HRM — Full Database Migration Script
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS throughout
-- ============================================================

-- ============================================================
-- SECTION 1: ENUMS (create any missing enums)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RBTMessageSenderRole') THEN
    CREATE TYPE "RBTMessageSenderRole" AS ENUM ('RBT', 'ADMIN');
  END IF;
END $$;

-- ============================================================
-- SECTION 2: TABLES (create any that don't exist yet)
-- ============================================================

-- 2a. admin_notifications
CREATE TABLE IF NOT EXISTS "admin_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- 2b. rbt_messages
CREATE TABLE IF NOT EXISTS "rbt_messages" (
    "id" TEXT NOT NULL,
    "rbtProfileId" TEXT NOT NULL,
    "senderRole" "RBTMessageSenderRole" NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "rbt_messages_pkey" PRIMARY KEY ("id")
);

-- 2c. candidate_application_drafts
CREATE TABLE IF NOT EXISTS "candidate_application_drafts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "candidate_application_drafts_pkey" PRIMARY KEY ("id")
);

-- 2d. rbt_audit_logs
CREATE TABLE IF NOT EXISTS "rbt_audit_logs" (
    "id" TEXT NOT NULL,
    "rbtProfileId" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "dateTime" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "rbt_audit_logs_pkey" PRIMARY KEY ("id")
);

-- 2e. session_notes
CREATE TABLE IF NOT EXISTS "session_notes" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "rbtProfileId" TEXT NOT NULL,
    "summary" TEXT,
    "whereServicesWere" TEXT,
    "whosInvolved" TEXT,
    "goalsWorkedOn" TEXT,
    "behaviorsObserved" TEXT,
    "reinforcersUsed" TEXT,
    "generalComments" TEXT,
    "payloadJson" JSONB,
    "submittedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "session_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_notes_timeEntryId_key" UNIQUE ("timeEntryId")
);

-- 2f. scheduling_clients
CREATE TABLE IF NOT EXISTS "scheduling_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "preferredRbtEthnicity" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "scheduling_clients_pkey" PRIMARY KEY ("id")
);

-- 2g. client_assignments
CREATE TABLE IF NOT EXISTS "client_assignments" (
    "id" TEXT NOT NULL,
    "rbtProfileId" TEXT NOT NULL,
    "schedulingClientId" TEXT NOT NULL,
    "daysOfWeek" INTEGER[] DEFAULT '{}',
    "timeStart" TEXT,
    "timeEnd" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "client_assignments_pkey" PRIMARY KEY ("id")
);

-- 2h. company_settings
CREATE TABLE IF NOT EXISTS "company_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("key")
);

-- ============================================================
-- SECTION 3: NEW COLUMNS on existing tables
-- ============================================================

-- 3a. interviews: 1-hour reminder tracking
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "reminder_1hr_sent_at" TIMESTAMPTZ;

-- 3b. interviews: claim system — add column WITHOUT FK first (FK added separately below)
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "claimedByUserId" TEXT;

-- 3c. interview_notes: quick notes for redesigned UI
ALTER TABLE "interview_notes" ADD COLUMN IF NOT EXISTS "quickNotes" TEXT;

-- 3d. interview_notes: recommendation (HIRE / CONSIDER / REJECT)
ALTER TABLE "interview_notes" ADD COLUMN IF NOT EXISTS "recommendation" TEXT;

-- 3e-notes. interview_notes: structured fields for notes redesign
ALTER TABLE "interview_notes" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "interview_notes" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "interview_notes" ADD COLUMN IF NOT EXISTS "birthdate" TEXT;
ALTER TABLE "interview_notes" ADD COLUMN IF NOT EXISTS "currentAddress" TEXT;
ALTER TABLE "interview_notes" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;

-- 3e. onboarding_completions: download tracking & draft data
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "downloadedAt" TIMESTAMPTZ;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "signedPdfUrl" TEXT;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "signedPdfData" TEXT;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "storageBucket" TEXT;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "fieldValues" JSONB;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "draftData" JSONB;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "acknowledgmentJson" JSONB;

-- 3f. rbt_documents: filePath for Supabase storage
ALTER TABLE "rbt_documents" ADD COLUMN IF NOT EXISTS "filePath" TEXT;

-- 3g. time_entries: guardian unavailable fields
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "guardianUnavailableReason" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "guardianUnavailableNote" TEXT;

-- ============================================================
-- SECTION 4: FOREIGN KEYS (drop broken ones first, then recreate)
-- ============================================================

-- 4a. interviews.claimedByUserId → public.users(id)
ALTER TABLE "interviews" DROP CONSTRAINT IF EXISTS "interviews_claimedByUserId_fkey";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'interviews_claimedByUserId_fkey' AND table_name = 'interviews'
  ) THEN
    ALTER TABLE "interviews"
      ADD CONSTRAINT "interviews_claimedByUserId_fkey"
      FOREIGN KEY ("claimedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- 4a2. interview_scorecards.createdByUserId → public.users(id)
ALTER TABLE "interview_scorecards" DROP CONSTRAINT IF EXISTS "interview_scorecards_createdByUserId_fkey";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'interview_scorecards_createdByUserId_fkey' AND table_name = 'interview_scorecards'
  ) THEN
    ALTER TABLE "interview_scorecards"
      ADD CONSTRAINT "interview_scorecards_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 4a3. sessions.userId → public.users(id) (ensure correct reference)
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_userId_fkey";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sessions_userId_fkey' AND table_name = 'sessions'
  ) THEN
    ALTER TABLE "sessions"
      ADD CONSTRAINT "sessions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 4a4. activity_logs.userId → public.users(id)
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_userId_fkey";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activity_logs_userId_fkey' AND table_name = 'activity_logs'
  ) THEN
    ALTER TABLE "activity_logs"
      ADD CONSTRAINT "activity_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 4b. admin_notifications.userId → public.users(id)
ALTER TABLE "admin_notifications" DROP CONSTRAINT IF EXISTS "admin_notifications_userId_fkey";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'admin_notifications_userId_fkey' AND table_name = 'admin_notifications'
  ) THEN
    ALTER TABLE "admin_notifications"
      ADD CONSTRAINT "admin_notifications_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 4c. rbt_messages.rbtProfileId → rbt_profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rbt_messages_rbtProfileId_fkey' AND table_name = 'rbt_messages'
  ) THEN
    ALTER TABLE "rbt_messages"
      ADD CONSTRAINT "rbt_messages_rbtProfileId_fkey"
      FOREIGN KEY ("rbtProfileId") REFERENCES "public"."rbt_profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 4d. rbt_audit_logs.rbtProfileId → rbt_profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rbt_audit_logs_rbtProfileId_fkey' AND table_name = 'rbt_audit_logs'
  ) THEN
    ALTER TABLE "rbt_audit_logs"
      ADD CONSTRAINT "rbt_audit_logs_rbtProfileId_fkey"
      FOREIGN KEY ("rbtProfileId") REFERENCES "public"."rbt_profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 4e. session_notes FKs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'session_notes_timeEntryId_fkey' AND table_name = 'session_notes'
  ) THEN
    ALTER TABLE "session_notes"
      ADD CONSTRAINT "session_notes_timeEntryId_fkey"
      FOREIGN KEY ("timeEntryId") REFERENCES "public"."time_entries"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'session_notes_rbtProfileId_fkey' AND table_name = 'session_notes'
  ) THEN
    ALTER TABLE "session_notes"
      ADD CONSTRAINT "session_notes_rbtProfileId_fkey"
      FOREIGN KEY ("rbtProfileId") REFERENCES "public"."rbt_profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 4f. client_assignments FKs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_assignments_rbtProfileId_fkey' AND table_name = 'client_assignments'
  ) THEN
    ALTER TABLE "client_assignments"
      ADD CONSTRAINT "client_assignments_rbtProfileId_fkey"
      FOREIGN KEY ("rbtProfileId") REFERENCES "public"."rbt_profiles"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_assignments_schedulingClientId_fkey' AND table_name = 'client_assignments'
  ) THEN
    ALTER TABLE "client_assignments"
      ADD CONSTRAINT "client_assignments_schedulingClientId_fkey"
      FOREIGN KEY ("schedulingClientId") REFERENCES "public"."scheduling_clients"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- SECTION 5: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "admin_notifications_userId_isRead_idx" ON "admin_notifications"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "rbt_messages_rbtProfileId_createdAt_idx" ON "rbt_messages"("rbtProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "interviews_claimedByUserId_idx" ON "interviews"("claimedByUserId");
CREATE INDEX IF NOT EXISTS "interviews_reminder_15m_sent_at_idx" ON "interviews"("reminder_15m_sent_at");
CREATE INDEX IF NOT EXISTS "rbt_audit_logs_rbtProfileId_dateTime_idx" ON "rbt_audit_logs"("rbtProfileId", "dateTime");
CREATE INDEX IF NOT EXISTS "candidate_application_drafts_email_status_idx" ON "candidate_application_drafts"("email", "status");
CREATE INDEX IF NOT EXISTS "candidate_application_drafts_token_idx" ON "candidate_application_drafts"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_application_drafts_token_key" ON "candidate_application_drafts"("token");
CREATE INDEX IF NOT EXISTS "client_assignments_rbtProfileId_idx" ON "client_assignments"("rbtProfileId");
CREATE INDEX IF NOT EXISTS "client_assignments_schedulingClientId_idx" ON "client_assignments"("schedulingClientId");

-- ============================================================
-- SECTION 6: RLS POLICIES (allow app role full access)
-- ============================================================

DO $$
DECLARE
  app_role text := 'postgres';
  t text;
  tables text[] := ARRAY[
    'availability_slots', 'users', 'otp_codes', 'interview_email_logs',
    'candidate_application_drafts', 'time_entries', 'shifts', 'onboarding_tasks',
    'leave_requests', 'onboarding_documents', 'onboarding_completions', 'user_profiles',
    'rbt_audit_logs', 'interviews', 'rbt_documents', 'interview_notes',
    'sessions', 'activity_logs', 'rbt_profiles', 'interview_scorecards',
    'rbt_messages', 'admin_notifications', 'session_notes', 'client_assignments',
    'scheduling_clients', 'company_settings'
  ];
  pol_name text;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    pol_name := 'allow_app_' || replace(t, '.', '_');
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = t AND relnamespace = 'public'::regnamespace) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = pol_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
          pol_name, t, app_role
        );
        RAISE NOTICE 'Created policy % on public.%', pol_name, t;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- SECTION 7: SEED DATA (dev bypass user)
-- ============================================================

-- The local dev bypass uses id='local-dev-admin' but never inserts
-- a row into users, causing every FK constraint to fail.
INSERT INTO "users" ("id", "name", "email", "role", "isActive", "createdAt", "updatedAt")
VALUES ('local-dev-admin', 'Local Dev Admin', 'dev@riseandshine.local', 'ADMIN', true, now(), now())
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- DONE! All tables, columns, FKs, indexes, and RLS policies
-- are now in place. Restart your dev server (npm run dev).
-- ============================================================
