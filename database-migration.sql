-- Database Migration for RBT Document Upload and Interview Notes
-- Run this in your Supabase SQL Editor or via psql
-- Date: 2024

-- =====================================================
-- 1. Create RBTDocument Table
-- =====================================================
CREATE TABLE IF NOT EXISTS "rbt_documents" (
  "id" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileData" TEXT NOT NULL,
  "documentType" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rbt_documents_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "rbt_documents" 
  ADD CONSTRAINT "rbt_documents_rbtProfileId_fkey" 
  FOREIGN KEY ("rbtProfileId") 
  REFERENCES "rbt_profiles"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "rbt_documents_rbtProfileId_idx" 
  ON "rbt_documents"("rbtProfileId");

-- =====================================================
-- 2. Create InterviewNotes Table
-- =====================================================
CREATE TABLE IF NOT EXISTS "interview_notes" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "scriptVersion" TEXT NOT NULL DEFAULT '1.0',
  "greetingAnswer" TEXT,
  "basicInfoAnswer" TEXT,
  "experienceAnswer" TEXT,
  "heardAboutAnswer" TEXT,
  "abaPlatformsAnswer" TEXT,
  "communicationAnswer" TEXT,
  "availabilityAnswer" TEXT,
  "payExpectationsAnswer" TEXT,
  "previousCompanyAnswer" TEXT,
  "expectationsAnswer" TEXT,
  "closingNotes" TEXT,
  "fullName" TEXT,
  "birthdate" TEXT,
  "currentAddress" TEXT,
  "phoneNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interview_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "interview_notes_interviewId_key" UNIQUE ("interviewId")
);

-- Add foreign key constraints
ALTER TABLE "interview_notes" 
  ADD CONSTRAINT "interview_notes_interviewId_fkey" 
  FOREIGN KEY ("interviewId") 
  REFERENCES "interviews"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

ALTER TABLE "interview_notes" 
  ADD CONSTRAINT "interview_notes_rbtProfileId_fkey" 
  FOREIGN KEY ("rbtProfileId") 
  REFERENCES "rbt_profiles"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "interview_notes_interviewId_idx" 
  ON "interview_notes"("interviewId");

CREATE INDEX IF NOT EXISTS "interview_notes_rbtProfileId_idx" 
  ON "interview_notes"("rbtProfileId");

-- =====================================================
-- 3. Verify Tables Were Created
-- =====================================================
-- Run these queries to verify the tables were created successfully:
-- SELECT * FROM "rbt_documents" LIMIT 1;
-- SELECT * FROM "interview_notes" LIMIT 1;

-- =====================================================
-- Migration Complete!
-- =====================================================
-- After running this migration:
-- 1. The new tables will be available
-- 2. Your application will be able to store documents and interview notes
-- 3. The features will be fully functional

