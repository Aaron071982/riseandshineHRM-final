/**
 * Part 2 — BCBA portal roles + assigned BCBA user FK.
 * Run against the target DB (dev first):
 *   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/add-bcba-portal.sql
 * Or apply via prisma db push after schema change.
 */
-- CrmRole enum values
ALTER TYPE "CrmRole" ADD VALUE IF NOT EXISTS 'BCBA';
ALTER TYPE "CrmRole" ADD VALUE IF NOT EXISTS 'CLINICAL_LEAD';

-- Portal assignee on service_clients
ALTER TABLE "service_clients"
  ADD COLUMN IF NOT EXISTS "assignedBcbaId" TEXT;

CREATE INDEX IF NOT EXISTS "service_clients_assignedBcbaId_idx"
  ON "service_clients"("assignedBcbaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_clients_assignedBcbaId_fkey'
  ) THEN
    ALTER TABLE "service_clients"
      ADD CONSTRAINT "service_clients_assignedBcbaId_fkey"
      FOREIGN KEY ("assignedBcbaId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
