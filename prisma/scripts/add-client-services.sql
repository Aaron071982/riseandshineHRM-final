-- Client Services Portal (Phase 1) — PHI client database, documents, audit.
-- Run once on Supabase / Postgres. Idempotent.

DO $$ BEGIN
  CREATE TYPE "ServiceClientStatus" AS ENUM ('NEW', 'ACTIVE', 'ON_HOLD', 'DISCHARGED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceBtAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceClientDocumentType" AS ENUM (
    'INSURANCE_CARD',
    'MEDICAID_CARD',
    'DIAGNOSTIC_EVAL',
    'PHYSICIAN_REFERRAL',
    'IEP_IFSP',
    'CUSTODY_GUARDIAN',
    'PRIOR_ABA_RECORDS',
    'CONSENT_FORM',
    'MEET_AND_GREET_FORM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "service_clients" (
  "id" TEXT NOT NULL,
  "clientCode" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "status" "ServiceClientStatus" NOT NULL DEFAULT 'NEW',
  "dateOfBirth" DATE,
  "addressLine" TEXT,
  "city" TEXT,
  "borough" TEXT,
  "state" TEXT,
  "zip" TEXT,
  "insuranceProvider" TEXT,
  "insuranceId" TEXT,
  "diagnosis" TEXT,
  "parentName" TEXT,
  "parentPhone" TEXT,
  "parentEmail" TEXT,
  "parentRelationship" TEXT,
  "bcbaName" TEXT,
  "caseCoordinatorName" TEXT,
  "serviceStartDate" DATE,
  "serviceEndDate" DATE,
  "authLengthMonths" INTEGER,
  "authHours" DOUBLE PRECISION,
  "currentHoursPerWeek" DOUBLE PRECISION,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_clients_clientCode_key"
  ON "service_clients"("clientCode");
CREATE INDEX IF NOT EXISTS "service_clients_status_idx"
  ON "service_clients"("status");
CREATE INDEX IF NOT EXISTS "service_clients_borough_idx"
  ON "service_clients"("borough");
CREATE INDEX IF NOT EXISTS "service_clients_bcbaName_idx"
  ON "service_clients"("bcbaName");
CREATE INDEX IF NOT EXISTS "service_clients_caseCoordinatorName_idx"
  ON "service_clients"("caseCoordinatorName");
CREATE INDEX IF NOT EXISTS "service_clients_lastName_firstName_idx"
  ON "service_clients"("lastName", "firstName");

DO $$ BEGIN
  ALTER TABLE "service_clients"
    ADD CONSTRAINT "service_clients_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "service_client_bt_assignments" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "btName" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "ServiceBtAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_client_bt_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_client_bt_assignments_serviceClientId_status_idx"
  ON "service_client_bt_assignments"("serviceClientId", "status");

DO $$ BEGIN
  ALTER TABLE "service_client_bt_assignments"
    ADD CONSTRAINT "service_client_bt_assignments_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "service_client_documents" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "documentType" "ServiceClientDocumentType" NOT NULL,
  "collected" BOOLEAN NOT NULL DEFAULT false,
  "collectedAt" TIMESTAMP(3),
  "collectedBy" TEXT,
  "fileUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_client_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_client_documents_serviceClientId_documentType_key"
  ON "service_client_documents"("serviceClientId", "documentType");
CREATE INDEX IF NOT EXISTS "service_client_documents_serviceClientId_collected_idx"
  ON "service_client_documents"("serviceClientId", "collected");

DO $$ BEGIN
  ALTER TABLE "service_client_documents"
    ADD CONSTRAINT "service_client_documents_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_client_documents"
    ADD CONSTRAINT "service_client_documents_collectedBy_fkey"
    FOREIGN KEY ("collectedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "service_client_notes" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_client_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_client_notes_serviceClientId_createdAt_idx"
  ON "service_client_notes"("serviceClientId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "service_client_notes"
    ADD CONSTRAINT "service_client_notes_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_client_notes"
    ADD CONSTRAINT "service_client_notes_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "client_access_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "serviceClientId" TEXT,
  "action" TEXT NOT NULL,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_access_logs_userId_createdAt_idx"
  ON "client_access_logs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "client_access_logs_serviceClientId_createdAt_idx"
  ON "client_access_logs"("serviceClientId", "createdAt");
CREATE INDEX IF NOT EXISTS "client_access_logs_action_createdAt_idx"
  ON "client_access_logs"("action", "createdAt");

DO $$ BEGIN
  ALTER TABLE "client_access_logs"
    ADD CONSTRAINT "client_access_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_access_logs"
    ADD CONSTRAINT "client_access_logs_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "client_services_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_services_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_services_sessions_token_key"
  ON "client_services_sessions"("token");
CREATE INDEX IF NOT EXISTS "client_services_sessions_userId_expiresAt_idx"
  ON "client_services_sessions"("userId", "expiresAt");

DO $$ BEGIN
  ALTER TABLE "client_services_sessions"
    ADD CONSTRAINT "client_services_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: service_role full, postgres full, block anon — grants revoked from anon/authenticated
ALTER TABLE "service_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_client_bt_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_client_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_client_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_access_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_services_sessions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_clients_service_role_all" ON "service_clients";
CREATE POLICY "service_clients_service_role_all"
  ON "service_clients" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_clients_postgres_all" ON "service_clients";
CREATE POLICY "service_clients_postgres_all"
  ON "service_clients" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_clients_block_anon" ON "service_clients";
CREATE POLICY "service_clients_block_anon"
  ON "service_clients" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_client_bt_assignments_service_role_all" ON "service_client_bt_assignments";
CREATE POLICY "service_client_bt_assignments_service_role_all"
  ON "service_client_bt_assignments" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_client_bt_assignments_postgres_all" ON "service_client_bt_assignments";
CREATE POLICY "service_client_bt_assignments_postgres_all"
  ON "service_client_bt_assignments" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_client_bt_assignments_block_anon" ON "service_client_bt_assignments";
CREATE POLICY "service_client_bt_assignments_block_anon"
  ON "service_client_bt_assignments" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_client_documents_service_role_all" ON "service_client_documents";
CREATE POLICY "service_client_documents_service_role_all"
  ON "service_client_documents" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_client_documents_postgres_all" ON "service_client_documents";
CREATE POLICY "service_client_documents_postgres_all"
  ON "service_client_documents" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_client_documents_block_anon" ON "service_client_documents";
CREATE POLICY "service_client_documents_block_anon"
  ON "service_client_documents" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_client_notes_service_role_all" ON "service_client_notes";
CREATE POLICY "service_client_notes_service_role_all"
  ON "service_client_notes" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_client_notes_postgres_all" ON "service_client_notes";
CREATE POLICY "service_client_notes_postgres_all"
  ON "service_client_notes" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_client_notes_block_anon" ON "service_client_notes";
CREATE POLICY "service_client_notes_block_anon"
  ON "service_client_notes" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "client_access_logs_service_role_all" ON "client_access_logs";
CREATE POLICY "client_access_logs_service_role_all"
  ON "client_access_logs" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_access_logs_postgres_all" ON "client_access_logs";
CREATE POLICY "client_access_logs_postgres_all"
  ON "client_access_logs" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_access_logs_block_anon" ON "client_access_logs";
CREATE POLICY "client_access_logs_block_anon"
  ON "client_access_logs" FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "client_services_sessions_service_role_all" ON "client_services_sessions";
CREATE POLICY "client_services_sessions_service_role_all"
  ON "client_services_sessions" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_services_sessions_postgres_all" ON "client_services_sessions";
CREATE POLICY "client_services_sessions_postgres_all"
  ON "client_services_sessions" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_services_sessions_block_anon" ON "client_services_sessions";
CREATE POLICY "client_services_sessions_block_anon"
  ON "client_services_sessions" FOR ALL TO anon USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE "service_clients" FROM anon;
REVOKE ALL ON TABLE "service_clients" FROM authenticated;
REVOKE ALL ON TABLE "service_client_bt_assignments" FROM anon;
REVOKE ALL ON TABLE "service_client_bt_assignments" FROM authenticated;
REVOKE ALL ON TABLE "service_client_documents" FROM anon;
REVOKE ALL ON TABLE "service_client_documents" FROM authenticated;
REVOKE ALL ON TABLE "service_client_notes" FROM anon;
REVOKE ALL ON TABLE "service_client_notes" FROM authenticated;
REVOKE ALL ON TABLE "client_access_logs" FROM anon;
REVOKE ALL ON TABLE "client_access_logs" FROM authenticated;
REVOKE ALL ON TABLE "client_services_sessions" FROM anon;
REVOKE ALL ON TABLE "client_services_sessions" FROM authenticated;

GRANT ALL ON TABLE "service_clients" TO postgres, service_role;
GRANT ALL ON TABLE "service_client_bt_assignments" TO postgres, service_role;
GRANT ALL ON TABLE "service_client_documents" TO postgres, service_role;
GRANT ALL ON TABLE "service_client_notes" TO postgres, service_role;
GRANT ALL ON TABLE "client_access_logs" TO postgres, service_role;
GRANT ALL ON TABLE "client_services_sessions" TO postgres, service_role;
