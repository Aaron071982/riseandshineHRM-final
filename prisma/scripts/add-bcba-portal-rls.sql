/**
 * Prompt 1 — BCBA portal defense-in-depth RLS notes + policies.
 *
 * App auth is custom OTP sessions via Prisma (service_role / postgres), which
 * bypasses RLS. These policies still:
 *   1) Keep RLS enabled on client-scoped tables
 *   2) Block anon / authenticated PostgREST from reading PHI
 *   3) Document the intended assignment rule for a future JWT-mapped path
 *
 * Run after add-bcba-portal.sql:
 *   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/add-bcba-portal-rls.sql
 *
 * Assignment enforcement for BCBA / CLINICAL_LEAD remains in:
 *   lib/crm/access.ts, lib/crm/bcbaPortal.ts
 */

-- Ensure column exists (no-op if add-bcba-portal.sql already applied)
ALTER TABLE "service_clients"
  ADD COLUMN IF NOT EXISTS "assignedBcbaId" TEXT;

CREATE INDEX IF NOT EXISTS "service_clients_assignedBcbaId_idx"
  ON "service_clients"("assignedBcbaId");

-- Helper: app user id from JWT claim (optional future wiring).
-- Returns NULL when claim absent — policies then deny.
CREATE OR REPLACE FUNCTION public.crm_jwt_app_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      auth.jwt() ->> 'app_user_id',
      auth.jwt() ->> 'user_id',
      auth.jwt() ->> 'sub'
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_jwt_has_role(target_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_crm_roles r
    WHERE r."userId" = public.crm_jwt_app_user_id()
      AND r.role::text = target_role
      AND r."revokedAt" IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_jwt_can_read_service_client(client_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.crm_jwt_has_role('SUPER_ADMIN')
    OR public.crm_jwt_has_role('MANAGEMENT')
    OR public.crm_jwt_has_role('CLINICAL_LEAD')
    OR (
      public.crm_jwt_has_role('BCBA')
      AND EXISTS (
        SELECT 1 FROM public.service_clients c
        WHERE c.id = client_id
          AND c."deletedAt" IS NULL
          AND c."assignedBcbaId" = public.crm_jwt_app_user_id()
      )
    );
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'service_clients',
    'assessments',
    'assessment_attachments',
    'client_authorizations',
    'client_authorization_lines',
    'rbt_schedule_assignments',
    'client_intake_submissions'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- service_role / postgres keep full access (Next.js Prisma)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role_all', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_postgres_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO postgres USING (true) WITH CHECK (true)',
      t || '_postgres_all', t
    );

    -- Block publishable / anon
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_block_anon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t || '_block_anon', t
    );

    -- authenticated: deny unless JWT carries app_user_id + matching role/assignment
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated_bcba_read', t);
  END LOOP;
END $$;

-- service_clients SELECT for authenticated JWT carriers
DROP POLICY IF EXISTS service_clients_authenticated_bcba_read ON public.service_clients;
CREATE POLICY service_clients_authenticated_bcba_read
  ON public.service_clients
  FOR SELECT
  TO authenticated
  USING (
    "deletedAt" IS NULL
    AND public.crm_jwt_can_read_service_client(id)
  );

-- Child tables: read only when parent client is readable
DROP POLICY IF EXISTS assessments_authenticated_bcba_read ON public.assessments;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'assessments'
  ) THEN
    EXECUTE $p$
      CREATE POLICY assessments_authenticated_bcba_read
        ON public.assessments
        FOR SELECT
        TO authenticated
        USING (
          "deletedAt" IS NULL
          AND public.crm_jwt_can_read_service_client("serviceClientId")
        )
    $p$;
  END IF;
END $$;

COMMENT ON FUNCTION public.crm_jwt_can_read_service_client(text) IS
  'BCBA portal RLS helper: CLINICAL_LEAD all; BCBA only assignedBcbaId; SUPER_ADMIN/MANAGEMENT all. Requires JWT claim app_user_id mapped to public.users.id.';
