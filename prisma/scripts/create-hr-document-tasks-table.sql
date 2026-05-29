-- Run in Supabase Dashboard → SQL Editor (required for HR-Initiated Documents / LS-54).
-- Creates HRTaskStatus enum + hr_document_tasks table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HRTaskStatus') THEN
    CREATE TYPE "HRTaskStatus" AS ENUM (
      'PENDING_HR',
      'PENDING_BT',
      'PENDING_HR_SIGNOFF',
      'COMPLETE'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS hr_document_tasks (
  id              TEXT PRIMARY KEY,
  "rbtProfileId"  TEXT NOT NULL REFERENCES rbt_profiles(id) ON DELETE CASCADE,
  "documentType"  TEXT NOT NULL,
  status          "HRTaskStatus" NOT NULL DEFAULT 'PENDING_HR',
  "hrFileUrl"     TEXT,
  "btFileUrl"     TEXT,
  "hrUploadedAt"  TIMESTAMPTZ,
  "hrUploadedBy"  TEXT,
  "btUploadedAt"  TIMESTAMPTZ,
  "hrSignedOffAt" TIMESTAMPTZ,
  "hrSignedOffBy" TEXT,
  notes           TEXT,
  "emailSent"     BOOLEAN NOT NULL DEFAULT false,
  "emailSentAt"   TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_document_tasks_rbtProfileId_idx
  ON hr_document_tasks ("rbtProfileId");

CREATE INDEX IF NOT EXISTS hr_document_tasks_status_idx
  ON hr_document_tasks (status);

COMMENT ON TABLE hr_document_tasks IS 'HR-initiated onboarding docs (e.g. LS-54 wage notice) per RBT';
