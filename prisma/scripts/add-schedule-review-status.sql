-- Phase 14: schedule consolidation — provisional board-migration columns.
-- Dev: applied via `npm run db:push:dev` (schema.prisma is source of truth).
-- Prod: reviewed forward SQL after a manual Supabase backup + family-counts snapshot.
-- Additive only. Never DROP/TRUNCATE. Does not migrate session_slot rows
-- (that is scripts/migrate-board-slots.ts, dry-run by default).

DO $$ BEGIN
  ALTER TYPE "RbtScheduleSource" ADD VALUE 'BOARD_MIGRATION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RbtScheduleReviewStatus" AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'DISCARDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "reviewStatus" "RbtScheduleReviewStatus" NOT NULL DEFAULT 'NONE';

ALTER TABLE "rbt_schedule_assignments"
  ADD COLUMN IF NOT EXISTS "boardSlotId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "rbt_schedule_assignments_boardSlotId_key"
  ON "rbt_schedule_assignments" ("boardSlotId");

CREATE INDEX IF NOT EXISTS "rbt_schedule_assignments_reviewStatus_idx"
  ON "rbt_schedule_assignments" ("reviewStatus");

-- GO-LIVE (prod), after backup + `db:family-counts --snapshot`:
--   1. psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/add-schedule-review-status.sql
--   2. dotenv -e .env -- tsx scripts/migrate-board-slots.ts --prod-confirm   (dry-run)
--   3. dotenv -e .env -- tsx scripts/migrate-board-slots.ts --prod-confirm --confirm --report /tmp/board-mig-prod.json
--   4. dotenv -e .env -- tsx scripts/family-row-counts.ts --prod-confirm --compare /tmp/family-before.json
-- Cursor must not run these against prod.
