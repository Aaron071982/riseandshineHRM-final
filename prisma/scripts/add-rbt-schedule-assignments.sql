-- RBT weekly planning schedule (standalone — not Artemis / payroll).
-- Run once on Supabase / Postgres.

CREATE TABLE IF NOT EXISTS "rbt_schedule_assignments" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rbt_schedule_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_rbtProfileId_isActive_idx"
  ON "rbt_schedule_assignments"("rbtProfileId", "isActive");

CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_rbtProfileId_dayOfWeek_idx"
  ON "rbt_schedule_assignments"("rbtProfileId", "dayOfWeek");

DO $$ BEGIN
  ALTER TABLE "rbt_schedule_assignments"
    ADD CONSTRAINT "rbt_schedule_assignments_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rbt_schedule_assignments"
    ADD CONSTRAINT "rbt_schedule_assignments_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: service_role full, postgres full, block anon; revoke client grants
ALTER TABLE "rbt_schedule_assignments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbt_schedule_assignments_service_role_all" ON "rbt_schedule_assignments";
CREATE POLICY "rbt_schedule_assignments_service_role_all"
  ON "rbt_schedule_assignments"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "rbt_schedule_assignments_postgres_all" ON "rbt_schedule_assignments";
CREATE POLICY "rbt_schedule_assignments_postgres_all"
  ON "rbt_schedule_assignments"
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "rbt_schedule_assignments_block_anon" ON "rbt_schedule_assignments";
CREATE POLICY "rbt_schedule_assignments_block_anon"
  ON "rbt_schedule_assignments"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE "rbt_schedule_assignments" FROM anon;
REVOKE ALL ON TABLE "rbt_schedule_assignments" FROM authenticated;
GRANT ALL ON TABLE "rbt_schedule_assignments" TO postgres;
GRANT ALL ON TABLE "rbt_schedule_assignments" TO service_role;
