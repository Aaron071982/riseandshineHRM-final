-- Prompt 5 — private payroll-statements bucket (financial PII).
-- Create in Supabase Storage as private (no public policies).
-- App serves files only via short-lived signed URLs after ownership checks.
-- Prefer Dashboard → Storage → New bucket "payroll-statements" (Private) if
-- storage.buckets insert is restricted, then apply the policies below.
--
--   npx dotenv -e .env.development -- psql "$DIRECT_URL" -f prisma/scripts/add-payroll-statements-bucket.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'payroll-statements'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'payroll-statements',
      'payroll-statements',
      false,
      10485760,
      ARRAY['application/pdf']::text[]
    );
  END IF;
END $$;

DROP POLICY IF EXISTS "payroll_statements_service_role" ON storage.objects;
CREATE POLICY "payroll_statements_service_role"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'payroll-statements')
  WITH CHECK (bucket_id = 'payroll-statements');

DROP POLICY IF EXISTS "payroll_statements_block_anon" ON storage.objects;
CREATE POLICY "payroll_statements_block_anon"
  ON storage.objects FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "payroll_statements_block_authenticated" ON storage.objects;
CREATE POLICY "payroll_statements_block_authenticated"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'payroll-statements' AND false)
  WITH CHECK (false);
