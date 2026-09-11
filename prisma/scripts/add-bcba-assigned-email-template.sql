-- Add BCBA_ASSIGNED staff email template to CommTemplate enum.
-- Safe to re-run (IF NOT EXISTS).

DO $$ BEGIN
  ALTER TYPE "CommTemplate" ADD VALUE IF NOT EXISTS 'BCBA_ASSIGNED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
