-- Migration: Add user_profiles table + session metadata fields
-- Safe for existing Supabase databases (no destructive changes)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PreferredContactMethod') THEN
        CREATE TYPE "PreferredContactMethod" AS ENUM ('EMAIL', 'TEXT', 'CALL');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "preferredName" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "timezone" TEXT,
    "preferredContactMethod" "PreferredContactMethod",
    "bio" TEXT,
    "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "emergencyContactName" TEXT,
    "emergencyContactRelationship" TEXT,
    "emergencyContactPhone" TEXT,
    "profileImageUrl" TEXT,
    "employeeId" TEXT,
    "startDate" TIMESTAMP(3),
    "department" TEXT,
    "title" TEXT,
    "rbtCertificationNumber" TEXT,
    "rbtCertificationExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- Unique userId and FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_userId_key'
    ) THEN
        ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_key" UNIQUE ("userId");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_userId_fkey'
    ) THEN
        ALTER TABLE "user_profiles"
        ADD CONSTRAINT "user_profiles_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Add session metadata fields
ALTER TABLE "sessions"
    ADD COLUMN IF NOT EXISTS "device" TEXT,
    ADD COLUMN IF NOT EXISTS "browser" TEXT,
    ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
    ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

