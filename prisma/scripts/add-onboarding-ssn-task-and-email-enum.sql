-- Social Security card onboarding task type + email template (run once on existing PostgreSQL DBs)
DO $$ BEGIN
  ALTER TYPE "OnboardingTaskType" ADD VALUE 'SOCIAL_SECURITY_DOCUMENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "EmailTemplateType" ADD VALUE 'SOCIAL_SECURITY_UPLOAD_REMINDER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
