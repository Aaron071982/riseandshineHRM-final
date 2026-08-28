-- Phase E: Locked clinical assessment (additive)
-- Manual Supabase backup BEFORE applying on prod.

DO $$ BEGIN
  ALTER TYPE "CrmRole" ADD VALUE 'CLINICAL_SUPPORT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AssessmentArtifactType" AS ENUM (
    'INITIAL_REPORT',
    'VINELAND_3',
    'ATEC',
    'FAST',
    'JUSTIFICATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClinicalAssessmentLockState" AS ENUM ('DRAFT', 'LOCKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClinicalAssessmentCaptureMode" AS ENUM ('UPLOAD', 'STRUCTURED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "client_clinical_assessments" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "isCurrentVersion" BOOLEAN NOT NULL DEFAULT true,
  "captureMode" "ClinicalAssessmentCaptureMode" NOT NULL DEFAULT 'UPLOAD',
  "lockState" "ClinicalAssessmentLockState" NOT NULL DEFAULT 'DRAFT',
  "lockedAt" TIMESTAMP(3),
  "lockedByUserId" TEXT,
  "unlockedAt" TIMESTAMP(3),
  "unlockedByUserId" TEXT,
  "unlockReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT NOT NULL,
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "client_clinical_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_clinical_assessment_artifacts" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "artifactType" "AssessmentArtifactType" NOT NULL,
  "storagePath" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedByUserId" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  CONSTRAINT "client_clinical_assessment_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_clinical_assessments_serviceClientId_versionNumber_key"
  ON "client_clinical_assessments"("serviceClientId", "versionNumber");
CREATE INDEX IF NOT EXISTS "client_clinical_assessments_serviceClientId_isCurrentVersion_idx"
  ON "client_clinical_assessments"("serviceClientId", "isCurrentVersion");
CREATE INDEX IF NOT EXISTS "client_clinical_assessments_lockState_idx"
  ON "client_clinical_assessments"("lockState");

CREATE INDEX IF NOT EXISTS "client_clinical_assessment_artifacts_assessmentId_artifactType_idx"
  ON "client_clinical_assessment_artifacts"("assessmentId", "artifactType");
CREATE INDEX IF NOT EXISTS "client_clinical_assessment_artifacts_deletedAt_idx"
  ON "client_clinical_assessment_artifacts"("deletedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessments_serviceClientId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessments"
      ADD CONSTRAINT "client_clinical_assessments_serviceClientId_fkey"
      FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessments_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessments"
      ADD CONSTRAINT "client_clinical_assessments_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessments_lockedByUserId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessments"
      ADD CONSTRAINT "client_clinical_assessments_lockedByUserId_fkey"
      FOREIGN KEY ("lockedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessments_unlockedByUserId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessments"
      ADD CONSTRAINT "client_clinical_assessments_unlockedByUserId_fkey"
      FOREIGN KEY ("unlockedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessment_artifacts_assessmentId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessment_artifacts"
      ADD CONSTRAINT "client_clinical_assessment_artifacts_assessmentId_fkey"
      FOREIGN KEY ("assessmentId") REFERENCES "client_clinical_assessments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessment_artifacts_uploadedByUserId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessment_artifacts"
      ADD CONSTRAINT "client_clinical_assessment_artifacts_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessment_artifacts_deletedByUserId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessment_artifacts"
      ADD CONSTRAINT "client_clinical_assessment_artifacts_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
