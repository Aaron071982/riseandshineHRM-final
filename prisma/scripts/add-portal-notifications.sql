/**
 * Part — BCBA portal inbox (portal_notifications).
 * Run after add-bcba-portal.sql:
 *   npx dotenv -e .env -- psql "$DIRECT_URL" -f prisma/scripts/add-portal-notifications.sql
 */
DO $$ BEGIN
  CREATE TYPE "PortalNotificationType" AS ENUM (
    'CLIENT_ASSIGNED',
    'THERAPIST_ASSIGNED',
    'IN_COORDINATION',
    'READY_FOR_ASSESSMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "portal_notifications" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "type" "PortalNotificationType" NOT NULL,
  "payload" JSONB NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portal_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "portal_notifications_recipientUserId_readAt_createdAt_idx"
  ON "portal_notifications"("recipientUserId", "readAt", "createdAt");

CREATE INDEX IF NOT EXISTS "portal_notifications_recipientUserId_createdAt_idx"
  ON "portal_notifications"("recipientUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "portal_notifications_clientId_type_idx"
  ON "portal_notifications"("clientId", "type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portal_notifications_recipientUserId_fkey'
  ) THEN
    ALTER TABLE "portal_notifications"
      ADD CONSTRAINT "portal_notifications_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portal_notifications_clientId_fkey'
  ) THEN
    ALTER TABLE "portal_notifications"
      ADD CONSTRAINT "portal_notifications_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "service_clients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Defense-in-depth RLS (app uses service role; still block PostgREST anon)
ALTER TABLE "portal_notifications" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_notifications_deny_anon ON "portal_notifications";
CREATE POLICY portal_notifications_deny_anon ON "portal_notifications"
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
