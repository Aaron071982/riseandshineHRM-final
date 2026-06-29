-- Artemis session requests (BT asks trainer for help booking)
-- Run in Supabase SQL editor after deploying schema changes.

CREATE TYPE "ArtemisSessionRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TYPE "TrainingEmailType" ADD VALUE IF NOT EXISTS 'SESSION_REQUEST';

CREATE TABLE IF NOT EXISTS "artemis_session_requests" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "message" TEXT,
  "status" "ArtemisSessionRequestStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,

  CONSTRAINT "artemis_session_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "artemis_session_requests_status_idx" ON "artemis_session_requests"("status");
CREATE INDEX IF NOT EXISTS "artemis_session_requests_rbtProfileId_idx" ON "artemis_session_requests"("rbtProfileId");

ALTER TABLE "artemis_session_requests"
  ADD CONSTRAINT "artemis_session_requests_rbtProfileId_fkey"
  FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "artemis_session_requests"
  ADD CONSTRAINT "artemis_session_requests_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
