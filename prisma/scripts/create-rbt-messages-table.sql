-- Run this in Supabase Dashboard → SQL Editor when "max clients" blocks prisma db push.
-- Creates the rbt_messages table and enum so the RBT ↔ Admin messaging feature works.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RBTMessageSenderRole') THEN
    CREATE TYPE "RBTMessageSenderRole" AS ENUM ('RBT', 'ADMIN');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS rbt_messages (
  id           TEXT PRIMARY KEY,
  "rbtProfileId" TEXT NOT NULL REFERENCES rbt_profiles(id) ON DELETE CASCADE,
  "senderRole"   "RBTMessageSenderRole" NOT NULL,
  message      TEXT NOT NULL,
  "isRead"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rbt_messages_rbtProfileId_createdAt_idx"
  ON rbt_messages ("rbtProfileId", "createdAt");

COMMENT ON TABLE rbt_messages IS 'RBT ↔ Admin messaging (Need Help? modal and admin Messages page)';
