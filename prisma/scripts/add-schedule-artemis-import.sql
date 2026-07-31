-- Artemis schedule import: extend assignments + batches + client boroughs.
-- RLS: service_role + postgres full; anon/authenticated revoked.

-- ─── Enum ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "RbtScheduleSource" AS ENUM ('ARTEMIS_IMPORT', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── schedule_import_batches ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "schedule_import_batches" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "importedById" TEXT NOT NULL,
  "providerCount" INTEGER NOT NULL DEFAULT 0,
  "slotCount" INTEGER NOT NULL DEFAULT 0,
  "mode" TEXT NOT NULL DEFAULT 'REPLACE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "schedule_import_batches_periodStart_periodEnd_idx"
  ON "schedule_import_batches"("periodStart", "periodEnd");

DO $$ BEGIN
  ALTER TABLE "schedule_import_batches"
    ADD CONSTRAINT "schedule_import_batches_importedById_fkey"
    FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "schedule_import_batches" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedule_import_batches_service_role_all" ON "schedule_import_batches";
CREATE POLICY "schedule_import_batches_service_role_all"
  ON "schedule_import_batches" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "schedule_import_batches_postgres_all" ON "schedule_import_batches";
CREATE POLICY "schedule_import_batches_postgres_all"
  ON "schedule_import_batches" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "schedule_import_batches_block_anon" ON "schedule_import_batches";
CREATE POLICY "schedule_import_batches_block_anon"
  ON "schedule_import_batches" FOR ALL TO anon USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE "schedule_import_batches" FROM anon;
REVOKE ALL ON TABLE "schedule_import_batches" FROM authenticated;
GRANT ALL ON TABLE "schedule_import_batches" TO postgres;
GRANT ALL ON TABLE "schedule_import_batches" TO service_role;

-- ─── client_boroughs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "client_boroughs" (
  "id" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "borough" TEXT NOT NULL DEFAULT 'Unset',
  "notes" TEXT,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_boroughs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_boroughs_clientName_key" ON "client_boroughs"("clientName");
CREATE INDEX IF NOT EXISTS "client_boroughs_borough_idx" ON "client_boroughs"("borough");

DO $$ BEGIN
  ALTER TABLE "client_boroughs"
    ADD CONSTRAINT "client_boroughs_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "client_boroughs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_boroughs_service_role_all" ON "client_boroughs";
CREATE POLICY "client_boroughs_service_role_all"
  ON "client_boroughs" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_boroughs_postgres_all" ON "client_boroughs";
CREATE POLICY "client_boroughs_postgres_all"
  ON "client_boroughs" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_boroughs_block_anon" ON "client_boroughs";
CREATE POLICY "client_boroughs_block_anon"
  ON "client_boroughs" FOR ALL TO anon USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE "client_boroughs" FROM anon;
REVOKE ALL ON TABLE "client_boroughs" FROM authenticated;
GRANT ALL ON TABLE "client_boroughs" TO postgres;
GRANT ALL ON TABLE "client_boroughs" TO service_role;

-- ─── Extend rbt_schedule_assignments ────────────────────────────────────────
ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "source" "RbtScheduleSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "rbt_schedule_assignments" ADD COLUMN IF NOT EXISTS "clientBorough" TEXT;
ALTER TABLE "rbt_schedule_assignments" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;
ALTER TABLE "rbt_schedule_assignments" ADD COLUMN IF NOT EXISTS "periodStart" DATE;
ALTER TABLE "rbt_schedule_assignments" ADD COLUMN IF NOT EXISTS "periodEnd" DATE;

CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_importBatchId_idx"
  ON "rbt_schedule_assignments"("importBatchId");
CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_periodStart_periodEnd_idx"
  ON "rbt_schedule_assignments"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_clientBorough_idx"
  ON "rbt_schedule_assignments"("clientBorough");
CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_source_idx"
  ON "rbt_schedule_assignments"("source");

DO $$ BEGIN
  ALTER TABLE "rbt_schedule_assignments"
    ADD CONSTRAINT "rbt_schedule_assignments_importBatchId_fkey"
    FOREIGN KEY ("importBatchId") REFERENCES "schedule_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
