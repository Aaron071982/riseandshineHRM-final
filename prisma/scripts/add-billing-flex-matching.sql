-- Flexible BT matching + hours confirmation emails
-- Run manually in Supabase SQL editor.

ALTER TYPE "BillingMatchStatus" ADD VALUE IF NOT EXISTS 'PAYROLL_ONLY';

CREATE TABLE IF NOT EXISTS "payroll_only_people" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "artemisProviderName" TEXT NOT NULL,
  "email" TEXT,
  "hourlyPayRate" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_only_people_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_only_people_artemisProviderName_key"
  ON "payroll_only_people"("artemisProviderName");

ALTER TABLE "billing_entries"
  ADD COLUMN IF NOT EXISTS "payrollOnlyId" TEXT;

DO $$ BEGIN
  ALTER TABLE "billing_entries"
    ADD CONSTRAINT "billing_entries_payrollOnlyId_fkey"
    FOREIGN KEY ("payrollOnlyId") REFERENCES "payroll_only_people"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "billing_entries_payrollOnlyId_idx"
  ON "billing_entries"("payrollOnlyId");

DO $$ BEGIN
  CREATE TYPE "BillingHoursConfirmationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "billing_hours_confirmations" (
  "id" TEXT NOT NULL,
  "billingCycleId" TEXT NOT NULL,
  "rbtProfileId" TEXT,
  "payrollOnlyId" TEXT,
  "email" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "status" "BillingHoursConfirmationStatus" NOT NULL DEFAULT 'SENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_hours_confirmations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_hours_confirmations_billingCycleId_fkey"
    FOREIGN KEY ("billingCycleId") REFERENCES "billing_cycles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_hours_confirmations_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "billing_hours_confirmations_payrollOnlyId_fkey"
    FOREIGN KEY ("payrollOnlyId") REFERENCES "payroll_only_people"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "billing_hours_confirmations_billingCycleId_idx"
  ON "billing_hours_confirmations"("billingCycleId");
