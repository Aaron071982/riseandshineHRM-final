-- Billing & Payroll portal tables + RBT pay rate fields
-- Run manually in Supabase SQL editor if not using prisma migrate.

ALTER TABLE "rbt_profiles"
  ADD COLUMN IF NOT EXISTS "hourlyPayRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "artemisProviderName" TEXT,
  ADD COLUMN IF NOT EXISTS "payRateUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payRateUpdatedBy" TEXT;

DO $$ BEGIN
  CREATE TYPE "BillingCycleStatus" AS ENUM ('DRAFT', 'REVIEW', 'FINALIZED', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingMatchStatus" AS ENUM ('MATCHED', 'NEEDS_REVIEW', 'UNMATCHED', 'IGNORED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "billing_cycles" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "status" "BillingCycleStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceFileName" TEXT,
  "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalGrossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rbtCount" INTEGER NOT NULL DEFAULT 0,
  "uploadedById" TEXT NOT NULL,
  "finalizedById" TEXT,
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_cycles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_cycles_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "billing_cycles_finalizedById_fkey"
    FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "billing_cycles_status_idx" ON "billing_cycles"("status");

CREATE TABLE IF NOT EXISTS "billing_entries" (
  "id" TEXT NOT NULL,
  "billingCycleId" TEXT NOT NULL,
  "rbtProfileId" TEXT,
  "providerNameRaw" TEXT NOT NULL,
  "matchStatus" "BillingMatchStatus" NOT NULL,
  "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "suggestedRbtProfileId" TEXT,
  "totalSessions" INTEGER NOT NULL DEFAULT 0,
  "totalMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hourlyRate" DOUBLE PRECISION,
  "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "adjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "adjustmentNote" TEXT,
  "finalPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "role" TEXT,
  "notes" TEXT,
  "isExcluded" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_entries_billingCycleId_fkey"
    FOREIGN KEY ("billingCycleId") REFERENCES "billing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_entries_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "billing_entries_billingCycleId_idx" ON "billing_entries"("billingCycleId");
CREATE INDEX IF NOT EXISTS "billing_entries_matchStatus_idx" ON "billing_entries"("matchStatus");

CREATE TABLE IF NOT EXISTS "billing_sessions" (
  "id" TEXT NOT NULL,
  "billingEntryId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "dos" DATE NOT NULL,
  "scheduledMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actualMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "procedureCode" TEXT,
  "location" TEXT,
  "rawStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_sessions_billingEntryId_fkey"
    FOREIGN KEY ("billingEntryId") REFERENCES "billing_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "billing_sessions_billingEntryId_idx" ON "billing_sessions"("billingEntryId");
