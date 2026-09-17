/**
 * BCBA HRM login link + dedicated onboarding tables.
 * Run (dev first):
 *   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/add-bcba-hrm-login-onboarding.sql
 */

ALTER TABLE "bcba_profiles"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "bcba_profiles"
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "bcba_profiles_userId_key"
  ON "bcba_profiles"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bcba_profiles_userId_fkey'
  ) THEN
    ALTER TABLE "bcba_profiles"
      ADD CONSTRAINT "bcba_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "bcba_onboarding_documents" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "flowType" TEXT NOT NULL DEFAULT 'ESIGN',
  "pdfUrl" TEXT,
  "pdfData" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bcba_onboarding_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bcba_onboarding_documents_slug_key"
  ON "bcba_onboarding_documents"("slug");

CREATE INDEX IF NOT EXISTS "bcba_onboarding_documents_isActive_displayOrder_idx"
  ON "bcba_onboarding_documents"("isActive", "displayOrder");

CREATE TABLE IF NOT EXISTS "bcba_onboarding_completions" (
  "id" TEXT NOT NULL,
  "bcbaProfileId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "OnboardingCompletionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "completedAt" TIMESTAMP(3),
  "acknowledgmentJson" JSONB,
  "signedPdfUrl" TEXT,
  "signedPdfData" TEXT,
  "signatureText" TEXT,
  "signatureTimestamp" TIMESTAMP(3),
  "signatureIpAddress" TEXT,
  "signatureUserAgent" TEXT,
  "signatureConsentGiven" BOOLEAN NOT NULL DEFAULT false,
  "signatureMethod" TEXT,
  "auditTrailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bcba_onboarding_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bcba_onboarding_completions_bcbaProfileId_documentId_key"
  ON "bcba_onboarding_completions"("bcbaProfileId", "documentId");

CREATE INDEX IF NOT EXISTS "bcba_onboarding_completions_bcbaProfileId_idx"
  ON "bcba_onboarding_completions"("bcbaProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bcba_onboarding_completions_bcbaProfileId_fkey'
  ) THEN
    ALTER TABLE "bcba_onboarding_completions"
      ADD CONSTRAINT "bcba_onboarding_completions_bcbaProfileId_fkey"
      FOREIGN KEY ("bcbaProfileId") REFERENCES "bcba_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bcba_onboarding_completions_documentId_fkey'
  ) THEN
    ALTER TABLE "bcba_onboarding_completions"
      ADD CONSTRAINT "bcba_onboarding_completions_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "bcba_onboarding_documents"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
