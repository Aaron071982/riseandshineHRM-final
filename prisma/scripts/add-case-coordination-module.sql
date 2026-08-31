-- Case Coordination form module
-- Manual Supabase backup BEFORE applying on prod.
-- After SQL: re-run prisma/rls/apply-rls.sql for RLS on case_coordination.
-- Storage: reuse assessment-files bucket — paths under clients/{serviceClientId}/case-coordination/

DO $$ BEGIN
  CREATE TYPE "CaseCoordinationStatus" AS ENUM ('DRAFT', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "CommTemplate" ADD VALUE IF NOT EXISTS 'CASE_COORDINATION';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "case_coordination" (
  "id" TEXT NOT NULL,
  "service_client_id" TEXT NOT NULL,
  "status" "CaseCoordinationStatus" NOT NULL DEFAULT 'DRAFT',
  "overrides" JSONB,
  "confirmed_by" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "pdf_path" TEXT,
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "case_coordination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "case_coordination_service_client_id_idx"
  ON "case_coordination"("service_client_id");
CREATE INDEX IF NOT EXISTS "case_coordination_status_idx"
  ON "case_coordination"("status");
CREATE INDEX IF NOT EXISTS "case_coordination_deleted_at_idx"
  ON "case_coordination"("deleted_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_coordination_service_client_id_fkey'
  ) THEN
    ALTER TABLE "case_coordination"
      ADD CONSTRAINT "case_coordination_service_client_id_fkey"
      FOREIGN KEY ("service_client_id") REFERENCES "service_clients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_coordination_created_by_fkey'
  ) THEN
    ALTER TABLE "case_coordination"
      ADD CONSTRAINT "case_coordination_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_coordination_updated_by_fkey'
  ) THEN
    ALTER TABLE "case_coordination"
      ADD CONSTRAINT "case_coordination_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_coordination_confirmed_by_fkey'
  ) THEN
    ALTER TABLE "case_coordination"
      ADD CONSTRAINT "case_coordination_confirmed_by_fkey"
      FOREIGN KEY ("confirmed_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
