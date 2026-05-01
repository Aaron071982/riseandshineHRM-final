-- Track daily digest inclusion per interview to avoid duplicate sends.
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS "dailyDigestDate" DATE NULL;

CREATE INDEX IF NOT EXISTS interviews_dailyDigestDate_idx
  ON interviews ("dailyDigestDate");
