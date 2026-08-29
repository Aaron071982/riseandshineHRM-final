-- Phase 0: Initial Assessment & Treatment Plan module (data layer)
-- Manual Supabase backup BEFORE applying on prod.
--
-- After SQL: create private Supabase Storage bucket `assessment-files` (Dashboard or CLI).
-- Path convention: clients/{serviceClientId}/assessments/{assessmentId}/{sectionKey}/{uuid}-{filename}
-- Then re-run prisma/rls/apply-rls.sql for RLS policies on assessments + assessment_attachments.

DO $$ BEGIN
  CREATE TYPE "TreatmentAssessmentStatus" AS ENUM (
    'DRAFT',
    'IN_PROGRESS',
    'COMPLETED',
    'SIGNED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TreatmentAssessmentSource" AS ENUM ('FORM', 'UPLOAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "assessments" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "status" "TreatmentAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "source" "TreatmentAssessmentSource" NOT NULL DEFAULT 'FORM',
  "assessmentType" TEXT NOT NULL DEFAULT 'INITIAL',
  "reportDate" DATE,
  "summary" JSONB,
  "treatmentRequest" JSONB,
  "locationSchedule" JSONB,
  "bioPsychosocial" JSONB,
  "instruments" JSONB,
  "presentLevels" JSONB,
  "environmental" JSONB,
  "responseToTx" JSONB,
  "interventions" JSONB,
  "behaviors" JSONB,
  "goals" JSONB,
  "parentTraining" JSONB,
  "servicesProtocols" JSONB,
  "transitionPlan" JSONB,
  "coordination" JSONB,
  "recommendations" JSONB,
  "crisisPlan" JSONB,
  "signatures" JSONB,
  "completedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "assessment_attachments" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "assessment_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assessments_serviceClientId_idx"
  ON "assessments"("serviceClientId");
CREATE INDEX IF NOT EXISTS "assessments_status_idx"
  ON "assessments"("status");
CREATE INDEX IF NOT EXISTS "assessments_deletedAt_idx"
  ON "assessments"("deletedAt");

CREATE INDEX IF NOT EXISTS "assessment_attachments_assessmentId_idx"
  ON "assessment_attachments"("assessmentId");
CREATE INDEX IF NOT EXISTS "assessment_attachments_deletedAt_idx"
  ON "assessment_attachments"("deletedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_serviceClientId_fkey'
  ) THEN
    ALTER TABLE "assessments"
      ADD CONSTRAINT "assessments_serviceClientId_fkey"
      FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "assessments"
      ADD CONSTRAINT "assessments_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_updatedByUserId_fkey'
  ) THEN
    ALTER TABLE "assessments"
      ADD CONSTRAINT "assessments_updatedByUserId_fkey"
      FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_attachments_assessmentId_fkey'
  ) THEN
    ALTER TABLE "assessment_attachments"
      ADD CONSTRAINT "assessment_attachments_assessmentId_fkey"
      FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_attachments_uploadedByUserId_fkey'
  ) THEN
    ALTER TABLE "assessment_attachments"
      ADD CONSTRAINT "assessment_attachments_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
