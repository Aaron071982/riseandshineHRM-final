-- Migration: Add RBTAuditLog table
-- This migration adds the audit log functionality for tracking admin interactions with RBTs

CREATE TABLE IF NOT EXISTS "rbt_audit_logs" (
    "id" TEXT NOT NULL,
    "rbtProfileId" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rbt_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS "rbt_audit_logs_rbtProfileId_dateTime_idx" ON "rbt_audit_logs"("rbtProfileId", "dateTime");

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rbt_audit_logs_rbtProfileId_fkey'
    ) THEN
        ALTER TABLE "rbt_audit_logs" 
        ADD CONSTRAINT "rbt_audit_logs_rbtProfileId_fkey" 
        FOREIGN KEY ("rbtProfileId") 
        REFERENCES "rbt_profiles"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;
