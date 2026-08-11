-- Client Services Phase 2: schedule link + breaks.
-- Run once on Supabase / Postgres. Idempotent.

-- Link schedule assignments → service_clients
ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "serviceClientId" TEXT;
ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "serviceClientLinkManual" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_serviceClientId_idx"
  ON "rbt_schedule_assignments"("serviceClientId");

DO $$ BEGIN
  ALTER TABLE "rbt_schedule_assignments"
    ADD CONSTRAINT "rbt_schedule_assignments_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClientBreakStatus" AS ENUM ('ON_BREAK', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClientBreakReason" AS ENUM ('VACATION', 'MEDICAL', 'FAMILY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "client_service_breaks" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "reason" "ClientBreakReason" NOT NULL DEFAULT 'OTHER',
  "startDate" DATE NOT NULL,
  "expectedReturnDate" DATE NOT NULL,
  "actualReturnDate" DATE,
  "status" "ClientBreakStatus" NOT NULL DEFAULT 'ON_BREAK',
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_service_breaks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_service_breaks_serviceClientId_status_idx"
  ON "client_service_breaks"("serviceClientId", "status");
CREATE INDEX IF NOT EXISTS "client_service_breaks_expectedReturnDate_idx"
  ON "client_service_breaks"("expectedReturnDate");

DO $$ BEGIN
  ALTER TABLE "client_service_breaks"
    ADD CONSTRAINT "client_service_breaks_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_service_breaks"
    ADD CONSTRAINT "client_service_breaks_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "client_rbt_breaks" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "btName" TEXT NOT NULL,
  "reason" "ClientBreakReason" NOT NULL DEFAULT 'OTHER',
  "startDate" DATE NOT NULL,
  "expectedReturnDate" DATE NOT NULL,
  "actualReturnDate" DATE,
  "status" "ClientBreakStatus" NOT NULL DEFAULT 'ON_BREAK',
  "coverageNotes" TEXT,
  "hasCoverage" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_rbt_breaks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_rbt_breaks_serviceClientId_status_idx"
  ON "client_rbt_breaks"("serviceClientId", "status");
CREATE INDEX IF NOT EXISTS "client_rbt_breaks_expectedReturnDate_idx"
  ON "client_rbt_breaks"("expectedReturnDate");

DO $$ BEGIN
  ALTER TABLE "client_rbt_breaks"
    ADD CONSTRAINT "client_rbt_breaks_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_rbt_breaks"
    ADD CONSTRAINT "client_rbt_breaks_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "client_service_breaks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_rbt_breaks" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_service_breaks_service_role_all" ON "client_service_breaks";
CREATE POLICY "client_service_breaks_service_role_all"
  ON "client_service_breaks" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_service_breaks_postgres_all" ON "client_service_breaks";
CREATE POLICY "client_service_breaks_postgres_all"
  ON "client_service_breaks" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_service_breaks_block_anon" ON "client_service_breaks";
CREATE POLICY "client_service_breaks_block_anon"
  ON "client_service_breaks" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "client_rbt_breaks_service_role_all" ON "client_rbt_breaks";
CREATE POLICY "client_rbt_breaks_service_role_all"
  ON "client_rbt_breaks" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_rbt_breaks_postgres_all" ON "client_rbt_breaks";
CREATE POLICY "client_rbt_breaks_postgres_all"
  ON "client_rbt_breaks" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_rbt_breaks_block_anon" ON "client_rbt_breaks";
CREATE POLICY "client_rbt_breaks_block_anon"
  ON "client_rbt_breaks" FOR ALL TO anon USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE "client_service_breaks" FROM anon;
REVOKE ALL ON TABLE "client_service_breaks" FROM authenticated;
REVOKE ALL ON TABLE "client_rbt_breaks" FROM anon;
REVOKE ALL ON TABLE "client_rbt_breaks" FROM authenticated;
GRANT ALL ON TABLE "client_service_breaks" TO postgres, service_role;
GRANT ALL ON TABLE "client_rbt_breaks" TO postgres, service_role;

-- Hours-gap threshold setting (optional seed)
INSERT INTO "company_settings" ("key", "value", "updatedAt")
VALUES ('client_services_hours_gap_threshold', '0'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
