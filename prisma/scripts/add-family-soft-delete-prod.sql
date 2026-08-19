-- Phase 13: family soft-delete columns (prod-safe, idempotent)
-- Target: riseandshine-hrm-prod (yhxcqxivimjulxpchmxu)
--
-- BEFORE RUN: manual Supabase backup (Dashboard → Database → Backups)
-- Run with: psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/add-family-soft-delete-prod.sql
--
-- Prod audit 2026-08-19: ALL tables below missing deletedAt/deletedByUserId except
-- client_consents and client_referral_checks (Phase 16 — already present; omitted here).
--
-- Additive only. No DROP / TRUNCATE / DELETE / FK constraints.

BEGIN;

ALTER TABLE "service_clients"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "client_requirements"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "client_authorizations"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "client_authorization_lines"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "client_tasks"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "client_communications"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "client_alerts"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "service_client_notes"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "service_client_bt_assignments"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "service_clients_deletedAt_idx" ON "service_clients" ("deletedAt");
CREATE INDEX IF NOT EXISTS "client_requirements_deletedAt_idx" ON "client_requirements" ("deletedAt");
CREATE INDEX IF NOT EXISTS "client_authorizations_deletedAt_idx" ON "client_authorizations" ("deletedAt");
CREATE INDEX IF NOT EXISTS "client_authorization_lines_deletedAt_idx" ON "client_authorization_lines" ("deletedAt");
CREATE INDEX IF NOT EXISTS "client_tasks_deletedAt_idx" ON "client_tasks" ("deletedAt");
CREATE INDEX IF NOT EXISTS "client_communications_deletedAt_idx" ON "client_communications" ("deletedAt");
CREATE INDEX IF NOT EXISTS "client_alerts_deletedAt_idx" ON "client_alerts" ("deletedAt");
CREATE INDEX IF NOT EXISTS "service_client_notes_deletedAt_idx" ON "service_client_notes" ("deletedAt");
CREATE INDEX IF NOT EXISTS "service_client_bt_assignments_deletedAt_idx" ON "service_client_bt_assignments" ("deletedAt");
CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_deletedAt_idx" ON "rbt_schedule_assignments" ("deletedAt");

COMMIT;
