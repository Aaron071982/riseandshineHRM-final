-- Phase 16: requirement attestation, grouping, consent lines, referral check.
-- Dev: applied via `npm run db:push:dev` (schema.prisma is source of truth).
-- Prod: reviewed forward SQL after a manual Supabase backup + family-counts snapshot.
-- Additive only. Does not remap requirement keys (that's scripts/migrate-requirement-keys.ts).

DO $$ BEGIN
  ALTER TYPE "RequirementStatus" ADD VALUE 'ON_FILE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RequirementGroup" AS ENUM ('INTAKE', 'CLINICAL', 'BILLING', 'CONSENT', 'STAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReferralSignerRole" AS ENUM ('PHYSICIAN', 'PSYCHOLOGIST', 'PSYCH_NP', 'PEDS_NP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "ClientAlertType" ADD VALUE 'DOC_EXPIRING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "client_requirements"
  ADD COLUMN IF NOT EXISTS "group" "RequirementGroup" NOT NULL DEFAULT 'STAGE',
  ADD COLUMN IF NOT EXISTS "attestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attestedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "client_requirements_group_idx"
  ON "client_requirements" ("group");

CREATE INDEX IF NOT EXISTS "client_requirements_serviceClientId_key_idx"
  ON "client_requirements" ("serviceClientId", "key");

CREATE TABLE IF NOT EXISTS "client_consents" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "lines" JSONB NOT NULL DEFAULT '{}',
  "signatureDate" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "signedByName" TEXT,
  "uetaConsentGiven" BOOLEAN NOT NULL DEFAULT false,
  "signatureMethod" TEXT,
  "signedIp" TEXT,
  "secondParentRequired" BOOLEAN NOT NULL DEFAULT false,
  "secondParentName" TEXT,
  "secondParentSignedAt" TIMESTAMP(3),
  "staffWitnessUserId" TEXT,
  "staffWitnessedAt" TIMESTAMP(3),
  "billingReady" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  CONSTRAINT "client_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_consents_serviceClientId_key"
  ON "client_consents" ("serviceClientId");
CREATE INDEX IF NOT EXISTS "client_consents_billingReady_idx"
  ON "client_consents" ("billingReady");
CREATE INDEX IF NOT EXISTS "client_consents_deletedAt_idx"
  ON "client_consents" ("deletedAt");

CREATE TABLE IF NOT EXISTS "client_referral_checks" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "signedByRole" "ReferralSignerRole",
  "hasAsdDx" BOOLEAN NOT NULL DEFAULT false,
  "initialDxDate" DATE,
  "severitySupportLevel" TEXT,
  "abaRequiredStatement" BOOLEAN NOT NULL DEFAULT false,
  "dsm5ChecklistAttached" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  CONSTRAINT "client_referral_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_referral_checks_serviceClientId_key"
  ON "client_referral_checks" ("serviceClientId");
CREATE INDEX IF NOT EXISTS "client_referral_checks_deletedAt_idx"
  ON "client_referral_checks" ("deletedAt");

DO $$ BEGIN
  ALTER TABLE "client_consents"
    ADD CONSTRAINT "client_consents_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_referral_checks"
    ADD CONSTRAINT "client_referral_checks_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- GO-LIVE (prod), after backup + family-counts snapshot:
--   1. psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/add-requirement-attestation-consent.sql
--   2. dotenv -e .env -- tsx scripts/migrate-requirement-keys.ts --prod-confirm
--   3. dotenv -e .env -- tsx scripts/migrate-requirement-keys.ts --prod-confirm --confirm
--   4. dotenv -e .env -- tsx scripts/family-row-counts.ts --prod-confirm --compare /tmp/family-before.json
-- Cursor must not run these against prod.
