-- Migration: Add storageBucket and fieldValues fields to onboarding_completions
-- Run this migration after updating Prisma schema

-- Add storageBucket column (nullable)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_completions' 
    AND column_name = 'storageBucket'
  ) THEN
    ALTER TABLE "onboarding_completions" 
    ADD COLUMN "storageBucket" TEXT;
  END IF;
END $$;

-- Add fieldValues column (nullable JSON)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_completions' 
    AND column_name = 'fieldValues'
  ) THEN
    ALTER TABLE "onboarding_completions" 
    ADD COLUMN "fieldValues" JSONB;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN "onboarding_completions"."storageBucket" IS 'Supabase Storage bucket name (e.g., onboarding-documents)';
COMMENT ON COLUMN "onboarding_completions"."fieldValues" IS 'Stores extracted field values for debugging/audit purposes';

