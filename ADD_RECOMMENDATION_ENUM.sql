-- =====================================================
-- Add Recommendation Enum and Field to Interview Notes
-- =====================================================
-- This script adds the InterviewRecommendation enum and 
-- recommendation field to the interview_notes table
-- =====================================================

-- Add InterviewRecommendation enum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_type 
        WHERE typname = 'InterviewRecommendation'
    ) THEN
        CREATE TYPE "InterviewRecommendation" AS ENUM (
            'SUGGEST_HIRING',
            'SUGGEST_REJECTING',
            'STALLING'
        );
    END IF;
END $$;

-- Add recommendation column to interview_notes table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'interview_notes' 
        AND column_name = 'recommendation'
    ) THEN
        ALTER TABLE "interview_notes" 
        ADD COLUMN "recommendation" "InterviewRecommendation";
    END IF;
END $$;

-- =====================================================
-- Migration Complete!
-- =====================================================
-- After running this migration:
-- 1. The InterviewRecommendation enum will be available
-- 2. The recommendation column will exist in interview_notes table
-- 3. The application will be able to store and retrieve recommendations

