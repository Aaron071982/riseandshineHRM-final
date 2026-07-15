-- YTD snapshot back-fill columns for payroll_runs / payroll_run_entries.
-- Extends existing tables (do not create parallel ones).
-- Run once on Supabase / Postgres after review. Do not auto-apply.

DO $$ BEGIN
  CREATE TYPE "PayrollSourceFormat" AS ENUM ('REGISTER', 'YTD_SNAPSHOT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── payroll_runs ─────────────────────────────────────────────────────────────

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "sourceFormat" "PayrollSourceFormat" NOT NULL DEFAULT 'REGISTER';

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "isDerived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "snapshotFileName" TEXT;

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "snapshotReportedAt" TIMESTAMP(3);

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "checksumOk" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "importWarnings" JSONB;

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "totalEmployeeTax" DOUBLE PRECISION;

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "totalEmployeeDeductions" DOUBLE PRECISION;

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "totalEmployerTax" DOUBLE PRECISION;

-- Re-upload same snapshot set updates instead of duplicating
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_payDate_sourceFormat_key"
  ON "payroll_runs"("payDate", "sourceFormat");

-- ── payroll_run_entries ──────────────────────────────────────────────────────

-- adjustedGross is register-only; YTD-derived rows store NULL
ALTER TABLE "payroll_run_entries"
  ALTER COLUMN "adjustedGross" DROP NOT NULL;

ALTER TABLE "payroll_run_entries"
  ALTER COLUMN "adjustedGross" DROP DEFAULT;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "isContractor" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "earningsLines" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "empTaxLines" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "empDeductionLines" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "employerTaxLines" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "employerDeductionLines" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "empDeductionTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "empTaxLocal" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "empTaxStateOther" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "reportedTotalValues" DOUBLE PRECISION;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "ytdGross" DOUBLE PRECISION;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "ytdNetPay" DOUBLE PRECISION;

ALTER TABLE "payroll_run_entries"
  ADD COLUMN IF NOT EXISTS "payrollEmployeeId" TEXT;

-- RLS already enabled on these tables; re-assert grants so new columns stay server-only
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_run_entries" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_runs_service_role_all" ON "payroll_runs";
CREATE POLICY "payroll_runs_service_role_all"
  ON "payroll_runs" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "payroll_runs_postgres_all" ON "payroll_runs";
CREATE POLICY "payroll_runs_postgres_all"
  ON "payroll_runs" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "payroll_runs_block_anon" ON "payroll_runs";
CREATE POLICY "payroll_runs_block_anon"
  ON "payroll_runs" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "payroll_run_entries_service_role_all" ON "payroll_run_entries";
CREATE POLICY "payroll_run_entries_service_role_all"
  ON "payroll_run_entries" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "payroll_run_entries_postgres_all" ON "payroll_run_entries";
CREATE POLICY "payroll_run_entries_postgres_all"
  ON "payroll_run_entries" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "payroll_run_entries_block_anon" ON "payroll_run_entries";
CREATE POLICY "payroll_run_entries_block_anon"
  ON "payroll_run_entries" FOR ALL TO anon USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE "payroll_runs" FROM anon;
REVOKE ALL ON TABLE "payroll_runs" FROM authenticated;
REVOKE ALL ON TABLE "payroll_run_entries" FROM anon;
REVOKE ALL ON TABLE "payroll_run_entries" FROM authenticated;
GRANT ALL ON TABLE "payroll_runs" TO postgres, service_role;
GRANT ALL ON TABLE "payroll_run_entries" TO postgres, service_role;
