-- RLS policies so the app can read/write when RLS is enabled and the DB role does NOT have BYPASSRLS.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) if you get 403/500 on admin routes or
-- interview notes (e.g. "Failed to save interview notes", "Failed to fetch interview notes").
-- Use the SAME Supabase project as your production DATABASE_URL.
--
-- Replace 'postgres' with your app's role if different: run SELECT current_user; in SQL Editor
-- while connected as your app (e.g. from a script that uses DATABASE_URL).

DO $$
DECLARE
  app_role text := 'postgres';
  t text;
  tables text[] := ARRAY[
    'availability_slots', 'users', 'otp_codes', 'interview_email_logs',
    'candidate_application_drafts', 'time_entries', 'shifts', 'onboarding_tasks',
    'leave_requests', 'onboarding_documents', 'onboarding_completions', 'user_profiles',
    'rbt_audit_logs', 'interviews', 'rbt_documents', 'interview_notes',
    'sessions', 'activity_logs', 'rbt_profiles', 'interview_scorecards',
    'rbt_messages', 'admin_notifications', 'session_notes', 'client_assignments',
    'scheduling_clients',
    'org_nodes'
  ];
  pol_name text;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    pol_name := 'allow_app_' || replace(t, '.', '_');
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = pol_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        pol_name, t, app_role
      );
      RAISE NOTICE 'Created policy % on public.%', pol_name, t;
    END IF;
  END LOOP;
END $$;
