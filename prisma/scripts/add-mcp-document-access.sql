-- MCP document-read: allowlist flag, OAuth token user binding, dedicated audit table.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "can_read_client_documents" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "oauth_access_tokens"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "oauth_access_tokens_userId_idx"
  ON "oauth_access_tokens"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oauth_access_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "oauth_access_tokens"
      ADD CONSTRAINT "oauth_access_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentAccessAction') THEN
    CREATE TYPE "DocumentAccessAction" AS ENUM (
      'LINK_ISSUED',
      'TEXT_RETURNED',
      'BLOCKED_TYPE',
      'BLOCKED_UNAUTHORIZED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "document_access_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "serviceClientId" TEXT,
  "documentId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "action" "DocumentAccessAction" NOT NULL,
  "mode" TEXT,
  "oauthClientId" TEXT,
  "tokenHashPrefix" TEXT,
  "ip" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_access_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_access_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_access_logs_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "document_access_logs_userId_createdAt_idx"
  ON "document_access_logs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "document_access_logs_serviceClientId_createdAt_idx"
  ON "document_access_logs"("serviceClientId", "createdAt");
CREATE INDEX IF NOT EXISTS "document_access_logs_documentType_createdAt_idx"
  ON "document_access_logs"("documentType", "createdAt");
CREATE INDEX IF NOT EXISTS "document_access_logs_action_createdAt_idx"
  ON "document_access_logs"("action", "createdAt");
