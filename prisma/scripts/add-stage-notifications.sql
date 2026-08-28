-- Phase C companion: internal stage-transition notification map + idempotency log.
-- Take a manual Supabase backup before applying to prod (DB_CHANGE_POLICY.md).

CREATE TYPE "StageNotificationRecipientType" AS ENUM ('EMAIL', 'ROLE');

CREATE TABLE IF NOT EXISTS "stage_notification_recipients" (
  "id" TEXT NOT NULL,
  "triggerKey" TEXT NOT NULL,
  "recipientType" "StageNotificationRecipientType" NOT NULL,
  "email" TEXT,
  "crmRole" "CrmRole",
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stage_notification_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stage_notification_recipients_triggerKey_enabled_idx"
  ON "stage_notification_recipients" ("triggerKey", "enabled");

CREATE TABLE IF NOT EXISTS "stage_notification_logs" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "triggerKey" TEXT NOT NULL,
  "stage" "ClientStage",
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stage_notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stage_notification_logs_serviceClientId_triggerKey_key"
  ON "stage_notification_logs" ("serviceClientId", "triggerKey");

CREATE INDEX IF NOT EXISTS "stage_notification_logs_serviceClientId_idx"
  ON "stage_notification_logs" ("serviceClientId");

-- Seed default recipient map (editable without code deploy).
INSERT INTO "stage_notification_recipients" ("id", "triggerKey", "recipientType", "email", "crmRole", "sortOrder")
VALUES
  ('snr_new_kazi', 'NEW_CLIENT', 'EMAIL', 'kazi@riseandshineaba.com', NULL, 1),
  ('snr_new_afrin', 'NEW_CLIENT', 'EMAIL', 'afrin@riseandshineaba.com', NULL, 2),
  ('snr_new_tisha', 'NEW_CLIENT', 'EMAIL', 'tisha@riseandshineaba.com', NULL, 3),
  ('snr_clinical_role', 'CLINICAL_ASSESSMENT', 'ROLE', NULL, 'CLINICAL', 1),
  ('snr_staffing_role', 'STAFFING', 'ROLE', NULL, 'STAFFING', 1),
  ('snr_active_afsana', 'ACTIVE', 'EMAIL', 'afsana@riseandshineaba.com', NULL, 1)
ON CONFLICT ("id") DO NOTHING;
