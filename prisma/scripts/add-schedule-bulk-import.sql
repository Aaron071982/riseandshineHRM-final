/**
 * One-time MCP bulk schedule import (preview → commit → rollback).
 * Run after unified payroll / schedule tables exist:
 *   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/add-schedule-bulk-import.sql
 */

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "can_bulk_import_schedule" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "ScheduleBulkImportStatus" AS ENUM (
    'PREVIEW',
    'AWAITING_ADMIN',
    'COMMITTED',
    'ROLLED_BACK',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "schedule_bulk_import_batches" (
  "id" TEXT PRIMARY KEY,
  "previewToken" TEXT NOT NULL UNIQUE,
  "actorUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" "ScheduleBulkImportStatus" NOT NULL DEFAULT 'PREVIEW',
  "requiresAdminApproval" BOOLEAN NOT NULL DEFAULT true,
  "adminApprovedAt" TIMESTAMP(3),
  "adminApprovedByUserId" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "entryCount" INTEGER NOT NULL DEFAULT 0,
  "okCount" INTEGER NOT NULL DEFAULT 0,
  "conflictCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "okEntriesJson" JSONB NOT NULL,
  "previewJson" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "committedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "schedule_bulk_import_batches_actorUserId_status_idx"
  ON "schedule_bulk_import_batches"("actorUserId", "status");
CREATE INDEX IF NOT EXISTS "schedule_bulk_import_batches_status_createdAt_idx"
  ON "schedule_bulk_import_batches"("status", "createdAt");

ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "bulkImportBatchId" TEXT;

DO $$ BEGIN
  ALTER TABLE "rbt_schedule_assignments"
    ADD CONSTRAINT "rbt_schedule_assignments_bulkImportBatchId_fkey"
    FOREIGN KEY ("bulkImportBatchId") REFERENCES "schedule_bulk_import_batches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_bulkImportBatchId_idx"
  ON "rbt_schedule_assignments"("bulkImportBatchId");

ALTER TABLE "schedule_bulk_import_batches" ENABLE ROW LEVEL SECURITY;
