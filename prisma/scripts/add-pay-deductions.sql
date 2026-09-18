/**
 * Prompt 5b — Itemized pay deductions for W-2 BT (RBT) stubs.
 * Run after add-unified-payroll.sql:
 *   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/add-pay-deductions.sql
 */

DO $$ BEGIN
  CREATE TYPE "DeductionCode" AS ENUM (
    'FED_INCOME',
    'SS',
    'MEDICARE',
    'NY_STATE',
    'NYC_LOCAL',
    'NY_SDI',
    'NY_PFL',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "pay_deductions" (
  "id" TEXT PRIMARY KEY,
  "payStatementId" TEXT NOT NULL,
  "code" "DeductionCode" NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "employeePaid" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "pay_deductions_payStatementId_idx"
  ON "pay_deductions"("payStatementId");

DO $$ BEGIN
  ALTER TABLE "pay_deductions"
    ADD CONSTRAINT "pay_deductions_payStatementId_fkey"
    FOREIGN KEY ("payStatementId") REFERENCES "pay_statements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "pay_deductions" ENABLE ROW LEVEL SECURITY;
