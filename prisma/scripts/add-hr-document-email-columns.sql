-- Run if hr_document_tasks exists but Send to RBT / list fails on email columns.
ALTER TABLE hr_document_tasks
  ADD COLUMN IF NOT EXISTS "emailSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMPTZ;
