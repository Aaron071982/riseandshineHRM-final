-- Sandbox schedule scenarios: overlays on the live schedule. Never modify rbt_schedule_assignments.
CREATE TABLE IF NOT EXISTS schedule_scenarios (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "changes" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT
);

CREATE INDEX IF NOT EXISTS "schedule_scenarios_deletedAt_idx" ON schedule_scenarios ("deletedAt");
