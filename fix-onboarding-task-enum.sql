-- Add FORTY_HOUR_COURSE_CERTIFICATE to OnboardingTaskType enum
-- Run this in your Supabase SQL Editor

-- First, check what the current enum values are
-- SELECT unnest(enum_range(NULL::"OnboardingTaskType"));

-- Add the new enum value
ALTER TYPE "OnboardingTaskType" ADD VALUE IF NOT EXISTS 'FORTY_HOUR_COURSE_CERTIFICATE';

-- Verify it was added
-- SELECT unnest(enum_range(NULL::"OnboardingTaskType"));

