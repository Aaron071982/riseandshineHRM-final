-- Interview System Overhaul: add claim columns, quickNotes, and admin_notifications
-- Run this in Supabase SQL Editor

-- 1. Add 1-hour reminder tracking column
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS "reminder_1hr_sent_at" TIMESTAMPTZ;

-- 2. Add claim system column (FK to users)
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS "claimedByUserId" TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "interviews_claimedByUserId_idx" ON interviews("claimedByUserId");

-- 3. Add quickNotes to interview_notes
ALTER TABLE interview_notes ADD COLUMN IF NOT EXISTS "quickNotes" TEXT;

-- 4. Add recommendation to interview_notes
ALTER TABLE interview_notes ADD COLUMN IF NOT EXISTS "recommendation" TEXT;

-- 5. Create admin_notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS "admin_notifications" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "admin_notifications_userId_isRead_idx" ON "admin_notifications"("userId", "isRead");
