-- Only if hr_document_tasks already exists without email columns (older deploys).
ALTER TABLE hr_document_tasks
  ADD COLUMN IF NOT EXISTS "emailSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMPTZ;
