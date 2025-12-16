-- Add FORTY_HOUR_COURSE_CERTIFICATE to OnboardingTaskType enum
-- Run this in your Supabase SQL Editor

-- Add the new enum value (PostgreSQL doesn't support IF NOT EXISTS for enum values)
-- If it already exists, this will fail gracefully - that's okay, just continue
DO $$ 
BEGIN
    -- Check if the value already exists
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

-- Verify it was added (uncomment to check)
-- SELECT unnest(enum_range(NULL::"OnboardingTaskType"));

