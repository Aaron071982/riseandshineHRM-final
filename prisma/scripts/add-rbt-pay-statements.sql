-- Employee pay statements (snapshots created on billing cycle finalize).
-- Run once on Supabase / Postgres.

CREATE TABLE IF NOT EXISTS "rbt_pay_statements" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "billingCycleId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "payableStatuses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "completedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "readyToBillHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "incompleteHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "inProgressHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "scheduledHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "payableHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hourlyRate" DOUBLE PRECISION NOT NULL,
  "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "adjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'FINALIZED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rbt_pay_statements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rbt_pay_statements_rbtProfileId_billingCycleId_key"
  ON "rbt_pay_statements"("rbtProfileId", "billingCycleId");
CREATE INDEX IF NOT EXISTS "rbt_pay_statements_rbtProfileId_status_idx"
  ON "rbt_pay_statements"("rbtProfileId", "status");
CREATE INDEX IF NOT EXISTS "rbt_pay_statements_billingCycleId_idx"
  ON "rbt_pay_statements"("billingCycleId");

DO $$ BEGIN
  ALTER TABLE "rbt_pay_statements"
    ADD CONSTRAINT "rbt_pay_statements_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rbt_pay_statements"
    ADD CONSTRAINT "rbt_pay_statements_billingCycleId_fkey"
    FOREIGN KEY ("billingCycleId") REFERENCES "billing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "rbt_pay_statement_sessions" (
  "id" TEXT NOT NULL,
  "payStatementId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "dos" DATE NOT NULL,
  "status" TEXT NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL,
  "procedureCode" TEXT,
  "isPayable" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "rbt_pay_statement_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rbt_pay_statement_sessions_payStatementId_idx"
  ON "rbt_pay_statement_sessions"("payStatementId");

DO $$ BEGIN
  ALTER TABLE "rbt_pay_statement_sessions"
    ADD CONSTRAINT "rbt_pay_statement_sessions_payStatementId_fkey"
    FOREIGN KEY ("payStatementId") REFERENCES "rbt_pay_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE "rbt_pay_statements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rbt_pay_statement_sessions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbt_pay_statements_service_role_all" ON "rbt_pay_statements";
CREATE POLICY "rbt_pay_statements_service_role_all"
  ON "rbt_pay_statements" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rbt_pay_statements_postgres_all" ON "rbt_pay_statements";
CREATE POLICY "rbt_pay_statements_postgres_all"
  ON "rbt_pay_statements" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rbt_pay_statements_block_anon" ON "rbt_pay_statements";
CREATE POLICY "rbt_pay_statements_block_anon"
  ON "rbt_pay_statements" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "rbt_pay_statement_sessions_service_role_all" ON "rbt_pay_statement_sessions";
CREATE POLICY "rbt_pay_statement_sessions_service_role_all"
  ON "rbt_pay_statement_sessions" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rbt_pay_statement_sessions_postgres_all" ON "rbt_pay_statement_sessions";
CREATE POLICY "rbt_pay_statement_sessions_postgres_all"
  ON "rbt_pay_statement_sessions" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rbt_pay_statement_sessions_block_anon" ON "rbt_pay_statement_sessions";
CREATE POLICY "rbt_pay_statement_sessions_block_anon"
  ON "rbt_pay_statement_sessions" FOR ALL TO anon USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE "rbt_pay_statements" FROM anon;
REVOKE ALL ON TABLE "rbt_pay_statements" FROM authenticated;
REVOKE ALL ON TABLE "rbt_pay_statement_sessions" FROM anon;
REVOKE ALL ON TABLE "rbt_pay_statement_sessions" FROM authenticated;
GRANT ALL ON TABLE "rbt_pay_statements" TO postgres, service_role;
GRANT ALL ON TABLE "rbt_pay_statement_sessions" TO postgres, service_role;
