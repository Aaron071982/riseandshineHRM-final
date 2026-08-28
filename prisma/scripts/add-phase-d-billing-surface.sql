-- Phase D: Billing / Authorization surface (additive)
-- Manual Supabase backup BEFORE applying on prod.

ALTER TABLE "client_authorizations"
  ADD COLUMN IF NOT EXISTS "sentToInsuranceAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sentToInsuranceByUserId" TEXT;

CREATE TABLE IF NOT EXISTS "client_billing_notes" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  CONSTRAINT "client_billing_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_authorization_templates" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  CONSTRAINT "client_authorization_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_billing_notes_serviceClientId_createdAt_idx"
  ON "client_billing_notes"("serviceClientId", "createdAt");
CREATE INDEX IF NOT EXISTS "client_billing_notes_deletedAt_idx"
  ON "client_billing_notes"("deletedAt");

CREATE INDEX IF NOT EXISTS "client_authorization_templates_serviceClientId_createdAt_idx"
  ON "client_authorization_templates"("serviceClientId", "createdAt");
CREATE INDEX IF NOT EXISTS "client_authorization_templates_deletedAt_idx"
  ON "client_authorization_templates"("deletedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_billing_notes_serviceClientId_fkey'
  ) THEN
    ALTER TABLE "client_billing_notes"
      ADD CONSTRAINT "client_billing_notes_serviceClientId_fkey"
      FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_billing_notes_authorId_fkey'
  ) THEN
    ALTER TABLE "client_billing_notes"
      ADD CONSTRAINT "client_billing_notes_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_billing_notes_deletedByUserId_fkey'
  ) THEN
    ALTER TABLE "client_billing_notes"
      ADD CONSTRAINT "client_billing_notes_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_authorization_templates_serviceClientId_fkey'
  ) THEN
    ALTER TABLE "client_authorization_templates"
      ADD CONSTRAINT "client_authorization_templates_serviceClientId_fkey"
      FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_authorization_templates_uploadedByUserId_fkey'
  ) THEN
    ALTER TABLE "client_authorization_templates"
      ADD CONSTRAINT "client_authorization_templates_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_authorization_templates_deletedByUserId_fkey'
  ) THEN
    ALTER TABLE "client_authorization_templates"
      ADD CONSTRAINT "client_authorization_templates_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_authorizations_sentToInsuranceByUserId_fkey'
  ) THEN
    ALTER TABLE "client_authorizations"
      ADD CONSTRAINT "client_authorizations_sentToInsuranceByUserId_fkey"
      FOREIGN KEY ("sentToInsuranceByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
