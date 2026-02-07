-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Order matters: add column first, then create table with FKs.

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

-- Add FKs only if they don't exist (safe to re-run)
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

-- 3) Add theme_preference to user_profiles (dark mode)
ALTER TABLE "user_profiles"
ADD COLUMN IF NOT EXISTS "themePreference" TEXT;
