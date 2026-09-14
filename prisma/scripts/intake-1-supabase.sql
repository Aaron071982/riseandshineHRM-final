/**
 * Intake packet :: 1 of 3 — Supabase / Postgres
 * Creates client_intake_submissions (append-only) for first-session kiosk forms.
 *
 * Run in the Supabase SQL Editor (or):
 *   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/intake-1-supabase.sql
 *
 * Do NOT paste kiosk-intake/intake-forms-schema.json here — that file is app config, not SQL.
 */

CREATE TABLE IF NOT EXISTS "client_intake_submissions" (
  "id"                   TEXT NOT NULL,
  "serviceClientId"      TEXT NOT NULL,
  "packetId"             TEXT NOT NULL,
  "formCode"             TEXT NOT NULL,
  "formTitle"            TEXT NOT NULL,
  "fieldValuesJson"      JSONB NOT NULL,
  "filledPdfData"        TEXT,
  "signedByName"         TEXT NOT NULL,
  "signedByRelationship" TEXT NOT NULL,
  "signatureImageData"   TEXT,
  "signatureHash"        TEXT,
  "signatureConsentGiven" BOOLEAN NOT NULL DEFAULT true,
  "signatureIpAddress"   TEXT,
  "signatureUserAgent"   TEXT,
  "kioskDeviceId"        TEXT,
  "locationLabel"        TEXT,
  "submittedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_intake_submissions_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_intake_submissions_serviceClientId_fkey'
  ) THEN
    ALTER TABLE "client_intake_submissions"
      ADD CONSTRAINT "client_intake_submissions_serviceClientId_fkey"
      FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "client_intake_submissions_serviceClientId_submittedAt_idx"
  ON "client_intake_submissions"("serviceClientId", "submittedAt");

CREATE INDEX IF NOT EXISTS "client_intake_submissions_packetId_idx"
  ON "client_intake_submissions"("packetId");

CREATE INDEX IF NOT EXISTS "client_intake_submissions_formCode_idx"
  ON "client_intake_submissions"("serviceClientId", "formCode");

-- Append-only: block UPDATE / DELETE (same idea as attendance events).
CREATE OR REPLACE FUNCTION prevent_client_intake_submission_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'client_intake_submissions is append-only; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS client_intake_submissions_immutable ON "client_intake_submissions";
CREATE TRIGGER client_intake_submissions_immutable
  BEFORE UPDATE OR DELETE ON "client_intake_submissions"
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_client_intake_submission_mutation();
