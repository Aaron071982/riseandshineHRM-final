-- Additive fail-safe: soft-delete columns on family / PHI-adjacent tables.
-- Dev: applied via `npm run db:push:dev` (schema.prisma is source of truth).
-- Prod: reviewed forward SQL after a manual Supabase backup. Never DROP/TRUNCATE.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

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
