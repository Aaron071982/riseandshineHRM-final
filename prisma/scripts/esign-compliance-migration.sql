-- E-SIGN / UETA compliance: user_profiles, onboarding_completions, signature_certificates, email template enum

-- EmailTemplateType: add DOCUMENT_SIGNATURE_RECEIPT (append to enum — adjust if your DB uses different enum name)
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'DOCUMENT_SIGNATURE_RECEIPT';

-- UserProfile e-sign consent
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "eSignConsentGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "eSignConsentTimestamp" TIMESTAMP(3);

-- OnboardingCompletion signature audit fields
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "signatureText" TEXT;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "signatureTimestamp" TIMESTAMP(3);
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "signatureIpAddress" TEXT;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "signatureUserAgent" TEXT;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "signatureConsentGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "signatureMethod" TEXT;
ALTER TABLE "onboarding_completions" ADD COLUMN IF NOT EXISTS "auditTrailJson" JSONB;

-- Signature certificates
CREATE TABLE IF NOT EXISTS "signature_certificates" (
    "id" TEXT NOT NULL,
    "onboardingCompletionId" TEXT NOT NULL,
    "rbtProfileId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "documentSlug" TEXT NOT NULL,
    "signerFullName" TEXT NOT NULL,
    "signerEmail" TEXT,
    "signerIpAddress" TEXT,
    "signerUserAgent" TEXT,
    "signatureText" TEXT,
    "signatureTimestamp" TIMESTAMP(3) NOT NULL,
    "consentStatement" TEXT,
    "documentHash" TEXT NOT NULL,
    "certificateGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certificateJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "signature_certificates_onboardingCompletionId_key"
  ON "signature_certificates"("onboardingCompletionId");
CREATE INDEX IF NOT EXISTS "signature_certificates_rbtProfileId_idx"
  ON "signature_certificates"("rbtProfileId");
CREATE INDEX IF NOT EXISTS "signature_certificates_documentId_idx"
  ON "signature_certificates"("documentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signature_certificates_onboardingCompletionId_fkey'
  ) THEN
    ALTER TABLE "signature_certificates"
      ADD CONSTRAINT "signature_certificates_onboardingCompletionId_fkey"
      FOREIGN KEY ("onboardingCompletionId") REFERENCES "onboarding_completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signature_certificates_rbtProfileId_fkey'
  ) THEN
    ALTER TABLE "signature_certificates"
      ADD CONSTRAINT "signature_certificates_rbtProfileId_fkey"
      FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signature_certificates_documentId_fkey'
  ) THEN
    ALTER TABLE "signature_certificates"
      ADD CONSTRAINT "signature_certificates_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "onboarding_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
