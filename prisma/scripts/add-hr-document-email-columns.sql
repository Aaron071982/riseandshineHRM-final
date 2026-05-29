-- HR document notify email tracking (LS-54 Send to RBT)
ALTER TABLE hr_document_tasks
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
