-- OAuth tables for MCP connector (Claude OAuth 2.0 + PKCE)
-- Run manually in Supabase SQL editor if not using prisma migrate.

CREATE TABLE IF NOT EXISTS "oauth_clients" (
  "id" TEXT NOT NULL,
  "clientSecret" TEXT,
  "clientName" TEXT NOT NULL,
  "redirectUris" TEXT[] NOT NULL,
  "grantTypes" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "oauth_authorization_codes" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "codeChallenge" TEXT NOT NULL,
  "codeChallengeMethod" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "oauth_authorization_codes_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "oauth_authorization_codes_clientId_idx"
  ON "oauth_authorization_codes"("clientId");
CREATE INDEX IF NOT EXISTS "oauth_authorization_codes_expiresAt_idx"
  ON "oauth_authorization_codes"("expiresAt");

CREATE TABLE IF NOT EXISTS "oauth_access_tokens" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "oauth_access_tokens_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "oauth_access_tokens_clientId_idx"
  ON "oauth_access_tokens"("clientId");
CREATE INDEX IF NOT EXISTS "oauth_access_tokens_expiresAt_idx"
  ON "oauth_access_tokens"("expiresAt");
CREATE INDEX IF NOT EXISTS "oauth_access_tokens_revokedAt_idx"
  ON "oauth_access_tokens"("revokedAt");
