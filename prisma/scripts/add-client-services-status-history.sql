-- Client Services: status history for detail timeline.
-- Idempotent. RLS + 3 policies + grants revoked.

CREATE TABLE IF NOT EXISTS "service_client_status_history" (
  "id" TEXT NOT NULL,
  "serviceClientId" TEXT NOT NULL,
  "fromStatus" "ServiceClientStatus",
  "toStatus" "ServiceClientStatus" NOT NULL,
  "reason" TEXT,
  "changedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_client_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_client_status_history_serviceClientId_createdAt_idx"
  ON "service_client_status_history"("serviceClientId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "service_client_status_history"
    ADD CONSTRAINT "service_client_status_history_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_client_status_history"
    ADD CONSTRAINT "service_client_status_history_changedBy_fkey"
    FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "service_client_status_history" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_client_status_history_service_role_all" ON "service_client_status_history";
CREATE POLICY "service_client_status_history_service_role_all"
  ON "service_client_status_history" FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_client_status_history_postgres_all" ON "service_client_status_history";
CREATE POLICY "service_client_status_history_postgres_all"
  ON "service_client_status_history" FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_client_status_history_block_anon" ON "service_client_status_history";
CREATE POLICY "service_client_status_history_block_anon"
  ON "service_client_status_history" FOR ALL TO anon USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE "service_client_status_history" FROM anon;
REVOKE ALL ON TABLE "service_client_status_history" FROM authenticated;
GRANT ALL ON TABLE "service_client_status_history" TO postgres, service_role;
