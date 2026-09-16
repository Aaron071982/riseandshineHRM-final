/**
 * Prompt 3 — defense-in-depth RLS for unified payroll tables.
 * App auth uses Prisma service_role (bypasses RLS). These policies block
 * anon / unauthenticated PostgREST and document JWT-scoped future access.
 *
 *   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/add-unified-payroll-rls.sql
 */

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'contractor_profiles',
    'pay_rates',
    'pay_periods',
    'pay_statements',
    'pay_line_items'
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

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_block_anon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t || '_block_anon', t
    );

    -- authenticated: deny by default until JWT app_user_id payroll grants exist
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_block_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t || '_block_authenticated', t
    );
  END LOOP;
END $$;
