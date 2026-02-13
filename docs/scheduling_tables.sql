-- Scheduling System (beta) – create tables
-- Run this in your DB (e.g. Supabase SQL editor) if you prefer not to use Prisma migrate.
-- Then run: npx prisma generate

CREATE TABLE IF NOT EXISTS scheduling_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  "preferredRbtEthnicity" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS client_assignments (
  id TEXT PRIMARY KEY,
  "rbtProfileId" TEXT NOT NULL REFERENCES rbt_profiles(id) ON DELETE CASCADE,
  "schedulingClientId" TEXT NOT NULL REFERENCES scheduling_clients(id) ON DELETE CASCADE,
  "daysOfWeek" INTEGER[] NOT NULL,
  "timeStart" TEXT,
  "timeEnd" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_assignments_rbt ON client_assignments("rbtProfileId");
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON client_assignments("schedulingClientId");
