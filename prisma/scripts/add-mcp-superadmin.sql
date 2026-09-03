-- MCP super-admin: allowlist flag + sensitive access audit table.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mcp_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- Seed the five named executives (idempotent).
UPDATE "users"
SET "mcp_super_admin" = true
WHERE lower(email) IN (
  'irsal@riseandshineaba.com',
  'kazi@riseandshineaba.com',
  'siyam@riseandshineaba.com',
  'shazia@riseandshineaba.com',
  'fardeen@riseandshineaba.com'
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SensitiveAccessCategory') THEN
    CREATE TYPE "SensitiveAccessCategory" AS ENUM (
      'PAY', 'WORKED_SESSIONS', 'PAYROLL', 'DOCUMENT', 'OTHER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SensitiveAccessAction') THEN
    CREATE TYPE "SensitiveAccessAction" AS ENUM (
      'READ', 'BLOCKED_UNAUTHORIZED', 'BLOCKED_SCOPE'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sensitive_access_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "SensitiveAccessCategory" NOT NULL,
  "action" "SensitiveAccessAction" NOT NULL,
  "toolName" TEXT NOT NULL,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "subjectLabel" TEXT,
  "dateRangeFrom" DATE,
  "dateRangeTo" DATE,
  "oauthClientId" TEXT,
  "tokenHashPrefix" TEXT,
  "ip" TEXT,
  "reason" TEXT,
  "resultSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sensitive_access_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sensitive_access_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "sensitive_access_logs_userId_createdAt_idx"
  ON "sensitive_access_logs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "sensitive_access_logs_category_createdAt_idx"
  ON "sensitive_access_logs"("category", "createdAt");
CREATE INDEX IF NOT EXISTS "sensitive_access_logs_action_createdAt_idx"
  ON "sensitive_access_logs"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "sensitive_access_logs_toolName_createdAt_idx"
  ON "sensitive_access_logs"("toolName", "createdAt");
