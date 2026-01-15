-- Migration: Add ActivityLog table for tracking user activities
-- This table tracks page views, link clicks, button clicks, form submissions, login, and logout events

-- Create ActivityType enum
CREATE TYPE "ActivityType" AS ENUM (
  'PAGE_VIEW',
  'LINK_CLICK',
  'BUTTON_CLICK',
  'FORM_SUBMISSION',
  'LOGIN',
  'LOGOUT'
);

-- Create activity_logs table
CREATE TABLE "activity_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activityType" "ActivityType" NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "url" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");
CREATE INDEX "activity_logs_activityType_idx" ON "activity_logs"("activityType");
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
CREATE INDEX "activity_logs_resourceType_resourceId_idx" ON "activity_logs"("resourceType", "resourceId");
