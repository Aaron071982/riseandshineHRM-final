-- Company-wide document distribution (acknowledgment / download-upload / view-only).
-- Run once on Supabase / Postgres.

DO $$ BEGIN
  CREATE TYPE "CompanyDocumentType" AS ENUM ('ACKNOWLEDGMENT', 'DOWNLOAD_UPLOAD', 'VIEW_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CompanyDocumentRecipientStatus" AS ENUM ('PENDING', 'VIEWED', 'SIGNED', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "company_documents" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "documentType" "CompanyDocumentType" NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isTest" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "company_documents_isActive_isTest_idx"
  ON "company_documents"("isActive", "isTest");
CREATE INDEX IF NOT EXISTS "company_documents_createdAt_idx"
  ON "company_documents"("createdAt");

DO $$ BEGIN
  ALTER TABLE "company_documents"
    ADD CONSTRAINT "company_documents_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "company_document_recipients" (
  "id" TEXT NOT NULL,
  "companyDocumentId" TEXT NOT NULL,
  "rbtProfileId" TEXT NOT NULL,
  "status" "CompanyDocumentRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "signedName" TEXT,
  "signedAt" TIMESTAMP(3),
  "signatureIp" TEXT,
  "uploadedFileUrl" TEXT,
  "viewedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "emailSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_document_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_document_recipients_companyDocumentId_rbtProfileId_key"
  ON "company_document_recipients"("companyDocumentId", "rbtProfileId");
CREATE INDEX IF NOT EXISTS "company_document_recipients_rbtProfileId_status_idx"
  ON "company_document_recipients"("rbtProfileId", "status");
CREATE INDEX IF NOT EXISTS "company_document_recipients_companyDocumentId_status_idx"
  ON "company_document_recipients"("companyDocumentId", "status");

DO $$ BEGIN
  ALTER TABLE "company_document_recipients"
    ADD CONSTRAINT "company_document_recipients_companyDocumentId_fkey"
    FOREIGN KEY ("companyDocumentId") REFERENCES "company_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "company_document_recipients"
    ADD CONSTRAINT "company_document_recipients_rbtProfileId_fkey"
    FOREIGN KEY ("rbtProfileId") REFERENCES "rbt_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "company_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_document_recipients" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_documents_service_role_all" ON "company_documents";
CREATE POLICY "company_documents_service_role_all"
  ON "company_documents" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "company_documents_postgres_all" ON "company_documents";
CREATE POLICY "company_documents_postgres_all"
  ON "company_documents" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "company_documents_block_anon" ON "company_documents";
CREATE POLICY "company_documents_block_anon"
  ON "company_documents" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "company_document_recipients_service_role_all" ON "company_document_recipients";
CREATE POLICY "company_document_recipients_service_role_all"
  ON "company_document_recipients" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "company_document_recipients_postgres_all" ON "company_document_recipients";
CREATE POLICY "company_document_recipients_postgres_all"
  ON "company_document_recipients" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "company_document_recipients_block_anon" ON "company_document_recipients";
CREATE POLICY "company_document_recipients_block_anon"
  ON "company_document_recipients" FOR ALL TO anon USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE "company_documents" FROM anon;
REVOKE ALL ON TABLE "company_documents" FROM authenticated;
REVOKE ALL ON TABLE "company_document_recipients" FROM anon;
REVOKE ALL ON TABLE "company_document_recipients" FROM authenticated;
GRANT ALL ON TABLE "company_documents" TO postgres, service_role;
GRANT ALL ON TABLE "company_document_recipients" TO postgres, service_role;
