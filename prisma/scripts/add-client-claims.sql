-- Phase 17: durable per-user client_claims grants.
-- Dev: applied via `npm run db:push:dev` (schema.prisma is source of truth).
-- Prod: reviewed forward SQL after a manual Supabase backup + family-counts snapshot.
-- Additive only. Does not delete existing ownership / coordinator assignments.

DO $$ BEGIN
  CREATE TYPE "ClaimSource" AS ENUM ('CLAIM', 'ASSIGNED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "client_claims" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "ClaimSource" NOT NULL,
  "claimedByUserId" TEXT,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "releasedByUserId" TEXT,
  CONSTRAINT "client_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_claims_serviceClientId_releasedAt_idx"
  ON "client_claims" ("serviceClientId", "releasedAt");
CREATE INDEX IF NOT EXISTS "client_claims_userId_releasedAt_idx"
  ON "client_claims" ("userId", "releasedAt");
CREATE INDEX IF NOT EXISTS "client_claims_userId_serviceClientId_idx"
  ON "client_claims" ("userId", "serviceClientId");

DO $$ BEGIN
  ALTER TABLE "client_claims"
    ADD CONSTRAINT "client_claims_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_claims"
    ADD CONSTRAINT "client_claims_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_claims"
    ADD CONSTRAINT "client_claims_claimedByUserId_fkey"
    FOREIGN KEY ("claimedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_claims"
    ADD CONSTRAINT "client_claims_releasedByUserId_fkey"
    FOREIGN KEY ("releasedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
