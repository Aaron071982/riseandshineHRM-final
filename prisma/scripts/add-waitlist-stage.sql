-- Waitlist client stage (before Inquiry) + waitlist parent email template.
-- Safe to re-run.

DO $$ BEGIN
  ALTER TYPE "ClientStage" ADD VALUE IF NOT EXISTS 'WAITLIST' BEFORE 'INQUIRY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    -- Older Postgres without BEFORE support on IF NOT EXISTS: try plain add.
    BEGIN
      ALTER TYPE "ClientStage" ADD VALUE IF NOT EXISTS 'WAITLIST';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

DO $$ BEGIN
  ALTER TYPE "CommTemplate" ADD VALUE IF NOT EXISTS 'WAITLIST_NOTICE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
