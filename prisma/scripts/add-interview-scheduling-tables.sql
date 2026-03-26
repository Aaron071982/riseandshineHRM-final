-- Calendly-style interview scheduling tables
-- Run this if prisma migrate fails (e.g. shadow DB issues). Then prisma generate is enough.

CREATE TABLE IF NOT EXISTS "interviewer_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "acceptInterviewBookings" BOOLEAN NOT NULL DEFAULT true,
  "slotDurationMinutes" INTEGER NOT NULL DEFAULT 15,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interviewer_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "interviewer_availability" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startHour" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endHour" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interviewer_availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "interviewer_availability_userId_idx" ON "interviewer_availability"("userId");
CREATE INDEX IF NOT EXISTS "interviewer_availability_userId_dayOfWeek_idx" ON "interviewer_availability"("userId", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "interview_slots" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "interviewerAvailabilityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slotDate" DATE NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "isBooked" BOOLEAN NOT NULL DEFAULT false,
  "bookedByRbtProfileId" TEXT,
  "bookedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interview_slots_interviewerAvailabilityId_fkey" FOREIGN KEY ("interviewerAvailabilityId") REFERENCES "interviewer_availability"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "interview_slots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "interview_slots_bookedByRbtProfileId_fkey" FOREIGN KEY ("bookedByRbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "interview_slots_userId_idx" ON "interview_slots"("userId");
CREATE INDEX IF NOT EXISTS "interview_slots_slotDate_idx" ON "interview_slots"("slotDate");
CREATE INDEX IF NOT EXISTS "interview_slots_slotDate_userId_startTime_idx" ON "interview_slots"("slotDate", "userId", "startTime");
