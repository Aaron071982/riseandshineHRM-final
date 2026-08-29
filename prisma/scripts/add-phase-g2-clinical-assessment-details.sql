-- Phase G2: Clinical assessment key-details snapshot (additive)
-- Manual Supabase backup BEFORE applying on prod.

CREATE TABLE IF NOT EXISTS "client_clinical_assessment_details" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "patientName" TEXT,
  "dob" TIMESTAMP(3),
  "age" TEXT,
  "diagnosis" TEXT,
  "comorbidDiagnosis" TEXT,
  "reportDate" TIMESTAMP(3),
  "assessorName" TEXT,
  "assessorCredentials" TEXT,
  "referringProvider" TEXT,
  "npi" TEXT,
  "hrs97151" TEXT,
  "hrs97153" TEXT,
  "hrs97155" TEXT,
  "hrs97156" TEXT,
  "hrs97157" TEXT,
  "servicePeriod" TEXT,
  "locations" JSONB,
  "reasonForAssessment" TEXT,
  "interferingBehaviors" TEXT,
  "targetBehavior1" TEXT,
  "targetBehavior2" TEXT,
  "targetBehavior3" TEXT,
  "medications" TEXT,
  "allergies" TEXT,
  "reassessmentDate" TIMESTAMP(3),
  "riskFactors" JSONB,
  "riskFactorsOther" TEXT,
  "vinelandDate" TIMESTAMP(3),
  "atecDate" TIMESTAMP(3),
  "fastDate" TIMESTAMP(3),
  "vinelandCommScore" TEXT,
  "vinelandSocScore" TEXT,
  "goalAreas" JSONB,
  "speech" TEXT,
  "ot" TEXT,
  "pt" TEXT,
  "teacher" TEXT,
  "pcp" TEXT,
  "bcbaName" TEXT,
  "bcbaDate" TIMESTAMP(3),
  "parentName" TEXT,
  "parentDate" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByUserId" TEXT,
  CONSTRAINT "client_clinical_assessment_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_clinical_assessment_details_assessmentId_key"
  ON "client_clinical_assessment_details"("assessmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessment_details_assessmentId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessment_details"
      ADD CONSTRAINT "client_clinical_assessment_details_assessmentId_fkey"
      FOREIGN KEY ("assessmentId") REFERENCES "client_clinical_assessments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_clinical_assessment_details_updatedByUserId_fkey'
  ) THEN
    ALTER TABLE "client_clinical_assessment_details"
      ADD CONSTRAINT "client_clinical_assessment_details_updatedByUserId_fkey"
      FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
