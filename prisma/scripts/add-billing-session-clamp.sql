-- Schedule-window clamp fields for Artemis billing sessions.
ALTER TABLE "billing_sessions" ADD COLUMN IF NOT EXISTS "rawActualMinutes" DOUBLE PRECISION;
ALTER TABLE "billing_sessions" ADD COLUMN IF NOT EXISTS "clampedPayableMinutes" DOUBLE PRECISION;
ALTER TABLE "billing_sessions" ADD COLUMN IF NOT EXISTS "clampApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "billing_sessions" ADD COLUMN IF NOT EXISTS "reviewFlag" TEXT;
ALTER TABLE "billing_sessions" ADD COLUMN IF NOT EXISTS "scheduledStart" TIMESTAMP(3);
ALTER TABLE "billing_sessions" ADD COLUMN IF NOT EXISTS "scheduledEnd" TIMESTAMP(3);
ALTER TABLE "billing_sessions" ADD COLUMN IF NOT EXISTS "actualStart" TIMESTAMP(3);
ALTER TABLE "billing_sessions" ADD COLUMN IF NOT EXISTS "actualEnd" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "billing_sessions_reviewFlag_idx" ON "billing_sessions"("reviewFlag");
