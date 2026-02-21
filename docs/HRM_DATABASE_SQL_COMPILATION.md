# HRM system database – SQL compilation

This document collects **all SQL** that defines or alters the main HRM database (PostgreSQL / Supabase). The canonical schema is **prisma/schema.prisma**; the SQL below is the migration history plus supplemental scripts.

**Note:** Base tables (users, rbt_profiles, interviews, time_entries, shifts, sessions, etc.) were created by an initial Prisma migration or `db push` that may not be in this repo. To generate a single “create from empty” SQL script from the current Prisma schema, run:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

---

## 1. Prisma migrations (run in order)

Applied in chronological order. These assume the base schema already exists.

### 1.1 – 20250129000000_add_interview_scorecards

```sql
-- CreateTable
CREATE TABLE "interview_scorecards" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "comments" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_scorecards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "interview_scorecards_interviewId_idx" ON "interview_scorecards"("interviewId");
CREATE UNIQUE INDEX "interview_scorecards_interviewId_createdByUserId_key" ON "interview_scorecards"("interviewId", "createdByUserId");

ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### 1.2 – 20250129000001_add_interview_reminder_15m

```sql
ALTER TABLE "interviews" ADD COLUMN "reminder_15m_sent_at" TIMESTAMP(3);
CREATE INDEX "interviews_reminder_15m_sent_at_idx" ON "interviews"("reminder_15m_sent_at");
```

### 1.3 – 20260207000000_rbt_application_overhaul

```sql
ALTER TYPE "RBTStatus" ADD VALUE 'STALLED';

ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "preferredAgeGroupsJson" JSONB;
ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "authorizedToWork" BOOLEAN;
ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "canPassBackgroundCheck" BOOLEAN;
ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "cprFirstAidCertified" TEXT;
ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "experienceYearsDisplay" TEXT;

ALTER TABLE "interviews" ALTER COLUMN "durationMinutes" SET DEFAULT 30;

ALTER TABLE "rbt_documents" ADD COLUMN IF NOT EXISTS "filePath" TEXT;
```

### 1.4 – 20260218000000_mobile_attendance_sync

```sql
CREATE TYPE "SignatureStatus" AS ENUM ('SIGNED', 'MISSING', 'NA');

ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "signatureStatus" "SignatureStatus";
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "signatureImageUrl" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "guardianName" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "guardianUnavailableReason" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "guardianUnavailableNote" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "mobileClockEventIdClockIn" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "mobileClockEventIdClockOut" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_mobileClockEventIdClockIn_mobileCl_key" ON "time_entries"("mobileClockEventIdClockIn", "mobileClockEventIdClockOut");

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
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "session_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_notes_timeEntryId_key" ON "session_notes"("timeEntryId");
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_rbtProfileId_fkey" FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 2. Scheduling (beta) tables

**Source:** `docs/scheduling_tables.sql`. Creates scheduling clients and client assignments in the main HRM DB.

```sql
CREATE TABLE IF NOT EXISTS scheduling_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  "preferredRbtEthnicity" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS client_assignments (
  id TEXT PRIMARY KEY,
  "rbtProfileId" TEXT NOT NULL REFERENCES rbt_profiles(id) ON DELETE CASCADE,
  "schedulingClientId" TEXT NOT NULL REFERENCES scheduling_clients(id) ON DELETE CASCADE,
  "daysOfWeek" INTEGER[] NOT NULL,
  "timeStart" TEXT,
  "timeEnd" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_assignments_rbt ON client_assignments("rbtProfileId");
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON client_assignments("schedulingClientId");
```

---

## 3. Supabase supplemental migrations

**Source:** `prisma/supabase-migrations.sql`. Idempotent changes for production (OTP, columns, admin user). Run in Supabase SQL Editor if needed.

```sql
-- 1) Add 15m reminder column to interviews
ALTER TABLE "interviews"
ADD COLUMN IF NOT EXISTS "reminder_15m_sent_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "interviews_reminder_15m_sent_at_idx"
ON "interviews" ("reminder_15m_sent_at");

-- 2) Create interview_scorecards table
CREATE TABLE IF NOT EXISTS "interview_scorecards" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "scores" JSONB NOT NULL DEFAULT '{}',
  "comments" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "interview_scorecards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "interview_scorecards_interviewId_createdByUserId_key"
ON "interview_scorecards" ("interviewId", "createdByUserId");

CREATE INDEX IF NOT EXISTS "interview_scorecards_interviewId_idx"
ON "interview_scorecards" ("interviewId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_scorecards_interviewId_fkey') THEN
    ALTER TABLE "interview_scorecards"
    ADD CONSTRAINT "interview_scorecards_interviewId_fkey"
    FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_scorecards_createdByUserId_fkey') THEN
    ALTER TABLE "interview_scorecards"
    ADD CONSTRAINT "interview_scorecards_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Add theme_preference to user_profiles
ALTER TABLE "user_profiles"
ADD COLUMN IF NOT EXISTS "themePreference" TEXT;

-- 3b) Create otp_codes table (required for login)
CREATE TABLE IF NOT EXISTS "otp_codes" (
  "id" TEXT NOT NULL,
  "phoneNumber" TEXT,
  "email" TEXT,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "used" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "otp_codes_phoneNumber_code_idx" ON "otp_codes" ("phoneNumber", "code");
CREATE INDEX IF NOT EXISTS "otp_codes_email_code_idx" ON "otp_codes" ("email", "code");

-- 4) Align rbt_profiles with Prisma schema
ALTER TABLE "rbt_profiles"
ADD COLUMN IF NOT EXISTS "experienceYears" INTEGER,
ADD COLUMN IF NOT EXISTS "experienceYearsDisplay" TEXT,
ADD COLUMN IF NOT EXISTS "preferredAgeGroupsJson" JSONB,
ADD COLUMN IF NOT EXISTS "authorizedToWork" BOOLEAN,
ADD COLUMN IF NOT EXISTS "canPassBackgroundCheck" BOOLEAN,
ADD COLUMN IF NOT EXISTS "cprFirstAidCertified" TEXT,
ADD COLUMN IF NOT EXISTS "transportation" BOOLEAN,
ADD COLUMN IF NOT EXISTS "preferredHoursRange" TEXT,
ADD COLUMN IF NOT EXISTS "schedulingToken" TEXT;

-- 5) Ensure admin can log in (adjust email as needed)
UPDATE "users"
SET role = 'ADMIN', "isActive" = true
WHERE email = 'aaronsiam21@gmail.com';

-- 7) Add filePath to rbt_documents
ALTER TABLE "rbt_documents"
ADD COLUMN IF NOT EXISTS "filePath" TEXT;
```

---

## 4. Row Level Security (RLS)

**Source:** `prisma/supabase-rls.sql`. Enable RLS on all public tables. Only run if your DATABASE_URL role has “Bypass RLS” or you add policies; otherwise the app may be unable to read data.

```sql
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_application_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecards ENABLE ROW LEVEL SECURITY;
```

---

## 5. RLS rollback

**Source:** `prisma/supabase-rls-rollback.sql`. Run if RLS was enabled and the app can no longer load data (e.g. 403, zeros).

```sql
ALTER TABLE public.availability_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_application_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_completions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecards DISABLE ROW LEVEL SECURITY;
```

---

## Summary

| Section | Source | Purpose |
|--------|--------|---------|
| 1 | `prisma/migrations/*` | Incremental schema changes (interview scorecards, reminder column, RBT columns, time entry/session notes, SignatureStatus enum) |
| 2 | `docs/scheduling_tables.sql` | Scheduling clients and client assignments (beta) |
| 3 | `prisma/supabase-migrations.sql` | Idempotent production fixes (OTP, rbt_profiles columns, admin user, filePath) |
| 4 | `prisma/supabase-rls.sql` | Enable RLS on all public tables |
| 5 | `prisma/supabase-rls-rollback.sql` | Disable RLS if app cannot read data |

**Separate database:** The `scheduling-system/` app uses its own SQL in `scheduling-system/sql/` (001–009); that is a different database and is not included here.
