-- Team Hub: day-specific availability overrides
CREATE TABLE IF NOT EXISTS admin_availability_overrides (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "overrideType" TEXT NOT NULL CHECK ("overrideType" IN ('BLOCKED', 'CUSTOM')),
  "startHour" INTEGER NULL,
  "startMinute" INTEGER NULL,
  "endHour" INTEGER NULL,
  "endMinute" INTEGER NULL,
  reason TEXT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_availability_overrides_user_date_key
  ON admin_availability_overrides ("userId", "date");

CREATE INDEX IF NOT EXISTS admin_availability_overrides_date_idx
  ON admin_availability_overrides ("date");

CREATE INDEX IF NOT EXISTS admin_availability_overrides_user_date_idx
  ON admin_availability_overrides ("userId", "date");
