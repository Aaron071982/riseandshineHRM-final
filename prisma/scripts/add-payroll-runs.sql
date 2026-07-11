-- Payroll register uploads (employee pay stubs from finished .xls registers).
-- Run once on Supabase / Postgres.

DO $$ BEGIN
  CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollMatchStatus" AS ENUM ('MATCHED', 'NEEDS_REVIEW', 'UNMATCHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "rbt_profiles" ADD COLUMN IF NOT EXISTS "payrollName" TEXT;

CREATE TABLE IF NOT EXISTS "payroll_runs" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "payDate" DATE NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "sourceFileName" TEXT,
  "uploadedById" TEXT NOT NULL,
  "employeeCount" INTEGER NOT NULL DEFAULT 0,
  "totalNetPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalGrossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_runs_status_idx" ON "payroll_runs"("status");
CREATE INDEX IF NOT EXISTS "payroll_runs_payDate_idx" ON "payroll_runs"("payDate");

DO $$ BEGIN
  ALTER TABLE "payroll_runs"
    ADD CONSTRAINT "payroll_runs_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "payroll_run_entries" (
  "id" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "rbtProfileId" TEXT,
  "payrollName" TEXT NOT NULL,
  "matchStatus" "PayrollMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "adjustedGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "empTaxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "empTaxFIT" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "empTaxSS" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "empTaxMed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "empTaxNYIT" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "employerTaxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPayrollCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_run_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_run_entries_payrollRunId_rbtProfileId_key"
  ON "payroll_run_entries"("payrollRunId", "rbtProfileId");
CREATE INDEX IF NOT EXISTS "payroll_run_entries_payrollRunId_idx" ON "payroll_run_entries"("payrollRunId");
CREATE INDEX IF NOT EXISTS "payroll_run_entries_rbtProfileId_idx" ON "payroll_run_entries"("rbtProfileId");
CREATE INDEX IF NOT EXISTS "payroll_run_entries_matchStatus_idx" ON "payroll_run_entries"("matchStatus");

DO $$ BEGIN
  ALTER TABLE "payroll_run_entries"
    ADD CONSTRAINT "payroll_run_entries_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payroll_run_entries"
    ADD CONSTRAINT "payroll_run_entries_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS
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
