-- Migration: Add OnboardingDocument and OnboardingCompletion tables
-- Run this after updating Prisma schema and running `prisma generate`

-- Create enum types
DO $$ BEGIN
  CREATE TYPE "OnboardingDocumentType" AS ENUM ('ACKNOWLEDGMENT', 'FILLABLE_PDF');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OnboardingCompletionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create onboarding_documents table
CREATE TABLE IF NOT EXISTS "onboarding_documents" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "OnboardingDocumentType" NOT NULL,
  "pdfUrl" TEXT,
  "pdfData" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "onboarding_documents_pkey" PRIMARY KEY ("id")
);

-- Create onboarding_completions table
CREATE TABLE IF NOT EXISTS "onboarding_completions" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "OnboardingCompletionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "completedAt" TIMESTAMP(3),
  "acknowledgmentJson" JSONB,
  "signedPdfUrl" TEXT,
  "signedPdfData" TEXT,
  "draftData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "onboarding_completions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "onboarding_completions_rbtProfileId_documentId_key" UNIQUE ("rbtProfileId", "documentId")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "onboarding_completions_rbtProfileId_idx" ON "onboarding_completions"("rbtProfileId");
CREATE INDEX IF NOT EXISTS "onboarding_completions_documentId_idx" ON "onboarding_completions"("documentId");

-- Add foreign key constraints
DO $$ BEGIN
  ALTER TABLE "onboarding_completions" ADD CONSTRAINT "onboarding_completions_rbtProfileId_fkey" 
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_completions" ADD CONSTRAINT "onboarding_completions_documentId_fkey" 
    FOREIGN KEY ("documentId") REFERENCES "onboarding_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create unique constraint on slug
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_documents_slug_key" ON "onboarding_documents"("slug");
EXCEPTION
  WHEN duplicate_table THEN null;
END $$;

