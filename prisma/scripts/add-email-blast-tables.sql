-- One-time admin email blast campaigns + per-recipient send logs.
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).

DO $$
BEGIN
  CREATE TYPE "EmailBlastSendStatus" AS ENUM ('SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "email_blast_campaigns" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "sentByUserId" TEXT,
  "recipientCount" INTEGER,
  "successCount" INTEGER,
  "failureCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_blast_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_blast_campaigns_slug_key" ON "email_blast_campaigns"("slug");

CREATE TABLE IF NOT EXISTS "email_blast_send_logs" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "rbtProfileId" TEXT,
  "email" TEXT NOT NULL,
  "status" "EmailBlastSendStatus" NOT NULL,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_blast_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_blast_send_logs_campaignId_rbtProfileId_key"
  ON "email_blast_send_logs"("campaignId", "rbtProfileId");
CREATE INDEX IF NOT EXISTS "email_blast_send_logs_campaignId_idx" ON "email_blast_send_logs"("campaignId");
CREATE INDEX IF NOT EXISTS "email_blast_send_logs_email_idx" ON "email_blast_send_logs"("email");

DO $$
BEGIN
  ALTER TABLE "email_blast_campaigns"
    ADD CONSTRAINT "email_blast_campaigns_sentByUserId_fkey"
    FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "email_blast_send_logs"
    ADD CONSTRAINT "email_blast_send_logs_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "email_blast_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "email_blast_send_logs"
    ADD CONSTRAINT "email_blast_send_logs_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
