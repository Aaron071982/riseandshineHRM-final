-- Migration: Add REACH_OUT_EMAIL_SENT status and interview workflow fields
-- This migration adds:
-- 1. REACH_OUT_EMAIL_SENT to RBTStatus enum
-- 2. schedulingToken field to rbt_profiles table
-- 3. reminderSentAt field to interviews table

-- Step 1: Add REACH_OUT_EMAIL_SENT to RBTStatus enum
-- Note: PostgreSQL doesn't support adding enum values in the middle, so we need to:
-- 1. Create new enum with the value
-- 2. Alter column to use new enum
-- 3. Drop old enum
-- However, a simpler approach is to just add it at the end

DO $$ BEGIN
    -- Check if the enum value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'REACH_OUT_EMAIL_SENT' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RBTStatus')
    ) THEN
        -- Add the new enum value after REACH_OUT
        ALTER TYPE "RBTStatus" ADD VALUE IF NOT EXISTS 'REACH_OUT_EMAIL_SENT' AFTER 'REACH_OUT';
    END IF;
END $$;

-- Step 2: Add schedulingToken to rbt_profiles table
ALTER TABLE "rbt_profiles" 
ADD COLUMN IF NOT EXISTS "schedulingToken" TEXT;

-- Add unique constraint on schedulingToken
CREATE UNIQUE INDEX IF NOT EXISTS "rbt_profiles_schedulingToken_key" ON "rbt_profiles"("schedulingToken") WHERE "schedulingToken" IS NOT NULL;

-- Step 3: Add reminderSentAt to interviews table
ALTER TABLE "interviews" 
ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
