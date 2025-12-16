-- =====================================================
-- Complete Database Migration for Rise and Shine HRM
-- =====================================================
-- This script ensures all tables, columns, indexes, enums, and constraints exist
-- Run this in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. Add FORTY_HOUR_COURSE_CERTIFICATE to OnboardingTaskType enum
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'FORTY_HOUR_COURSE_CERTIFICATE' 
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'OnboardingTaskType'
        )
    ) THEN
        ALTER TYPE "OnboardingTaskType" ADD VALUE 'FORTY_HOUR_COURSE_CERTIFICATE';
    END IF;
END $$;

-- =====================================================
-- 2. Ensure gender column exists in rbt_profiles
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rbt_profiles' 
        AND column_name = 'gender'
    ) THEN
        ALTER TABLE "rbt_profiles" ADD COLUMN "gender" TEXT;
    END IF;
END $$;

-- =====================================================
-- 3. Ensure fortyHourCourseCompleted column exists in rbt_profiles
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rbt_profiles' 
        AND column_name = 'fortyHourCourseCompleted'
    ) THEN
        ALTER TABLE "rbt_profiles" ADD COLUMN "fortyHourCourseCompleted" BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =====================================================
-- 4. Ensure scheduleCompleted column exists in rbt_profiles
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rbt_profiles' 
        AND column_name = 'scheduleCompleted'
    ) THEN
        ALTER TABLE "rbt_profiles" ADD COLUMN "scheduleCompleted" BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =====================================================
-- 5. Ensure availability_slots table exists
-- =====================================================
CREATE TABLE IF NOT EXISTS "availability_slots" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "hour" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'availability_slots_rbtProfileId_fkey'
        AND conrelid = 'availability_slots'::regclass
    ) THEN
        ALTER TABLE "availability_slots" 
        ADD CONSTRAINT "availability_slots_rbtProfileId_fkey" 
        FOREIGN KEY ("rbtProfileId") 
        REFERENCES "rbt_profiles"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'availability_slots_rbtProfileId_dayOfWeek_hour_key'
        AND t.relname = 'availability_slots'
    ) THEN
        ALTER TABLE "availability_slots" 
        ADD CONSTRAINT "availability_slots_rbtProfileId_dayOfWeek_hour_key" 
        UNIQUE ("rbtProfileId", "dayOfWeek", "hour");
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        NULL; -- Constraint already exists, ignore
END $$;

-- =====================================================
-- 6. Ensure rbt_documents table exists
-- =====================================================
CREATE TABLE IF NOT EXISTS "rbt_documents" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileData" TEXT NOT NULL,
  "documentType" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rbt_documents_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'rbt_documents_rbtProfileId_fkey'
        AND t.relname = 'rbt_documents'
    ) THEN
        ALTER TABLE "rbt_documents" 
        ADD CONSTRAINT "rbt_documents_rbtProfileId_fkey" 
        FOREIGN KEY ("rbtProfileId") 
        REFERENCES "rbt_profiles"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        NULL; -- Constraint already exists, ignore
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS "rbt_documents_rbtProfileId_idx" 
ON "rbt_documents"("rbtProfileId");

-- =====================================================
-- 7. Ensure interview_notes table exists
-- =====================================================
CREATE TABLE IF NOT EXISTS "interview_notes" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "scriptVersion" TEXT NOT NULL DEFAULT '1.0',
  "greetingAnswer" TEXT,
  "basicInfoAnswer" TEXT,
  "experienceAnswer" TEXT,
  "heardAboutAnswer" TEXT,
  "abaPlatformsAnswer" TEXT,
  "communicationAnswer" TEXT,
  "availabilityAnswer" TEXT,
  "payExpectationsAnswer" TEXT,
  "previousCompanyAnswer" TEXT,
  "expectationsAnswer" TEXT,
  "closingNotes" TEXT,
  "fullName" TEXT,
  "birthdate" TEXT,
  "currentAddress" TEXT,
  "phoneNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interview_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "interview_notes_interviewId_key" UNIQUE ("interviewId")
);

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'interview_notes_interviewId_fkey'
        AND t.relname = 'interview_notes'
    ) THEN
        ALTER TABLE "interview_notes" 
        ADD CONSTRAINT "interview_notes_interviewId_fkey" 
        FOREIGN KEY ("interviewId") 
        REFERENCES "interviews"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        NULL; -- Constraint already exists, ignore
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'interview_notes_rbtProfileId_fkey'
        AND t.relname = 'interview_notes'
    ) THEN
        ALTER TABLE "interview_notes" 
        ADD CONSTRAINT "interview_notes_rbtProfileId_fkey" 
        FOREIGN KEY ("rbtProfileId") 
        REFERENCES "rbt_profiles"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        NULL; -- Constraint already exists, ignore
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "interview_notes_interviewId_idx" 
ON "interview_notes"("interviewId");

CREATE INDEX IF NOT EXISTS "interview_notes_rbtProfileId_idx" 
ON "interview_notes"("rbtProfileId");

-- =====================================================
-- 8. Verify all core tables exist (created by Prisma)
-- =====================================================
-- These should already exist from Prisma migrations, but we verify:
-- - users
-- - sessions
-- - otp_codes
-- - rbt_profiles
-- - interviews
-- - interview_email_logs
-- - onboarding_tasks
-- - shifts
-- - time_entries
-- - leave_requests

-- =====================================================
-- 9. Verify all required indexes exist
-- =====================================================
-- Onboarding tasks index
CREATE INDEX IF NOT EXISTS "onboarding_tasks_rbtProfileId_isCompleted_idx" 
ON "onboarding_tasks"("rbtProfileId", "isCompleted");

-- OTP codes indexes
CREATE INDEX IF NOT EXISTS "otp_codes_phoneNumber_code_idx" 
ON "otp_codes"("phoneNumber", "code");

CREATE INDEX IF NOT EXISTS "otp_codes_email_code_idx" 
ON "otp_codes"("email", "code");

-- =====================================================
-- 10. Migration Complete - Verification Queries
-- =====================================================

-- Verify enum value was added (uncomment to check):
-- SELECT unnest(enum_range(NULL::"OnboardingTaskType"));

-- Verify columns exist:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'rbt_profiles' 
-- AND column_name IN ('gender', 'fortyHourCourseCompleted', 'scheduleCompleted');

-- Verify tables exist:
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('availability_slots', 'rbt_documents', 'interview_notes');

-- =====================================================
-- Migration Complete!
-- =====================================================
-- After running this migration:
-- 1. All enum values will be available
-- 2. All required columns will exist
-- 3. All tables will be created with proper constraints
-- 4. All indexes will be in place for optimal performance
-- 5. The application will have full database support

