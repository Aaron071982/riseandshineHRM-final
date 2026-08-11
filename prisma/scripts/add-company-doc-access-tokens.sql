-- Magic-link tokens for company document VIEW_ONLY / ACKNOWLEDGMENT emails.
-- Run once on Supabase / Postgres.

ALTER TABLE "company_document_recipients"
  ADD COLUMN IF NOT EXISTS "accessTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "company_document_recipients_accessTokenHash_key"
  ON "company_document_recipients"("accessTokenHash");
