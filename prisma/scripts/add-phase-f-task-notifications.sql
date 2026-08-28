-- Phase F: Task notification preferences + send logs (additive)
-- Manual Supabase backup BEFORE applying on prod.

DO $$ BEGIN
  CREATE TYPE "TaskNotificationType" AS ENUM ('ASSIGNMENT', 'DIGEST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignmentEmails" BOOLEAN NOT NULL DEFAULT true,
  "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
  "digestFrequencyNights" INTEGER NOT NULL DEFAULT 2,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_notification_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "TaskNotificationType" NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB NOT NULL,
  CONSTRAINT "task_notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_key"
  ON "notification_preferences"("userId");

CREATE INDEX IF NOT EXISTS "task_notification_logs_userId_type_sentAt_idx"
  ON "task_notification_logs"("userId", "type", "sentAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_preferences_userId_fkey'
  ) THEN
    ALTER TABLE "notification_preferences"
      ADD CONSTRAINT "notification_preferences_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_notification_logs_userId_fkey'
  ) THEN
    ALTER TABLE "task_notification_logs"
      ADD CONSTRAINT "task_notification_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
