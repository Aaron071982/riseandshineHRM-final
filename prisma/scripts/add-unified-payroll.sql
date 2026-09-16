/**
 * Prompt 3 — Unified payroll domain (contractor BCBA + RBT reconciliation).
 * Run against the target DB (dev first):
 *   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/add-unified-payroll.sql
 * Or apply via prisma db push after schema change.
 */

DO $$ BEGIN
  CREATE TYPE "PayeeType" AS ENUM ('BCBA', 'RBT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayStatementStatus" AS ENUM ('DRAFT', 'READY', 'SENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LineSource" AS ENUM ('MANUAL', 'RECONCILIATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "contractor_profiles" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "legalName" TEXT NOT NULL,
  "entityName" TEXT,
  "classification" TEXT NOT NULL DEFAULT '1099',
  "activeRateId" TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "pay_rates" (
  "id" TEXT PRIMARY KEY,
  "contractorId" TEXT,
  "staffId" TEXT,
  "ratePerHour" DECIMAL(10, 2) NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "pay_periods" (
  "id" TEXT PRIMARY KEY,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "payDate" DATE NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "pay_statements" (
  "id" TEXT PRIMARY KEY,
  "payPeriodId" TEXT NOT NULL,
  "payeeType" "PayeeType" NOT NULL,
  "contractorId" TEXT,
  "staffId" TEXT,
  "status" "PayStatementStatus" NOT NULL DEFAULT 'DRAFT',
  "totalHours" DECIMAL(10, 2) NOT NULL,
  "grossPay" DECIMAL(12, 2) NOT NULL,
  "deductions" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "netPay" DECIMAL(12, 2) NOT NULL,
  "reconciled" BOOLEAN NOT NULL DEFAULT true,
  "pdfUrl" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "pay_line_items" (
  "id" TEXT PRIMARY KEY,
  "payStatementId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "startClock" TEXT NOT NULL,
  "endClock" TEXT NOT NULL,
  "hours" DECIMAL(10, 2) NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "source" "LineSource" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "pay_rates_contractorId_effectiveFrom_idx"
  ON "pay_rates"("contractorId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "pay_rates_staffId_effectiveFrom_idx"
  ON "pay_rates"("staffId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "pay_periods_startDate_endDate_idx"
  ON "pay_periods"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "pay_statements_payeeType_status_idx"
  ON "pay_statements"("payeeType", "status");
CREATE INDEX IF NOT EXISTS "pay_statements_staffId_idx"
  ON "pay_statements"("staffId");
CREATE INDEX IF NOT EXISTS "pay_statements_contractorId_idx"
  ON "pay_statements"("contractorId");
CREATE INDEX IF NOT EXISTS "pay_line_items_payStatementId_workDate_idx"
  ON "pay_line_items"("payStatementId", "workDate");

CREATE UNIQUE INDEX IF NOT EXISTS "pay_statements_period_payee_unique"
  ON "pay_statements"("payPeriodId", "payeeType", "contractorId", "staffId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contractor_profiles_userId_fkey'
  ) THEN
    ALTER TABLE "contractor_profiles"
      ADD CONSTRAINT "contractor_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pay_rates_contractorId_fkey'
  ) THEN
    ALTER TABLE "pay_rates"
      ADD CONSTRAINT "pay_rates_contractorId_fkey"
      FOREIGN KEY ("contractorId") REFERENCES "contractor_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pay_rates_staffId_fkey'
  ) THEN
    ALTER TABLE "pay_rates"
      ADD CONSTRAINT "pay_rates_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "rbt_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contractor_profiles_activeRateId_fkey'
  ) THEN
    ALTER TABLE "contractor_profiles"
      ADD CONSTRAINT "contractor_profiles_activeRateId_fkey"
      FOREIGN KEY ("activeRateId") REFERENCES "pay_rates"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pay_statements_payPeriodId_fkey'
  ) THEN
    ALTER TABLE "pay_statements"
      ADD CONSTRAINT "pay_statements_payPeriodId_fkey"
      FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pay_statements_contractorId_fkey'
  ) THEN
    ALTER TABLE "pay_statements"
      ADD CONSTRAINT "pay_statements_contractorId_fkey"
      FOREIGN KEY ("contractorId") REFERENCES "contractor_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pay_statements_staffId_fkey'
  ) THEN
    ALTER TABLE "pay_statements"
      ADD CONSTRAINT "pay_statements_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "rbt_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pay_line_items_payStatementId_fkey'
  ) THEN
    ALTER TABLE "pay_line_items"
      ADD CONSTRAINT "pay_line_items_payStatementId_fkey"
      FOREIGN KEY ("payStatementId") REFERENCES "pay_statements"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
