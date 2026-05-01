-- Team Hub: tables required by Prisma (AdminAvailability, AdminStatus, AdminCalendarNote).
-- Run in Supabase SQL Editor if `prisma migrate` is not applied. `users` must already exist.
-- (Overrides table: see add-admin-availability-overrides.sql)

-- Recurring weekly availability slots
CREATE TABLE IF NOT EXISTS admin_availability (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "dayOfWeek" INTEGER NOT NULL,
  "startHour" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endHour" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  label TEXT NULL,
  color TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_availability_userId_idx ON admin_availability ("userId");
CREATE INDEX IF NOT EXISTS admin_availability_dayOfWeek_idx ON admin_availability ("dayOfWeek");
CREATE INDEX IF NOT EXISTS admin_availability_userId_dayOfWeek_idx ON admin_availability ("userId", "dayOfWeek");

-- Per-day calendar notes (team calendar)
CREATE TABLE IF NOT EXISTS admin_calendar_notes (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "date" DATE NOT NULL,
  content TEXT NOT NULL,
  color TEXT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_calendar_notes_date_idx ON admin_calendar_notes ("date");
CREATE INDEX IF NOT EXISTS admin_calendar_notes_userId_date_idx ON admin_calendar_notes ("userId", "date");

-- One status row per admin user
CREATE TABLE IF NOT EXISTS admin_status (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  "statusEmoji" TEXT NULL,
  "statusMessage" TEXT NULL,
  "statusExpiresAt" TIMESTAMP(3) NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_status_status_idx ON admin_status (status);
CREATE INDEX IF NOT EXISTS admin_status_lastSeenAt_idx ON admin_status ("lastSeenAt");
