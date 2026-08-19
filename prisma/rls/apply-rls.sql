-- =============================================================================
-- prisma/rls/apply-rls.sql
-- Idempotent RLS for the PHI-safe DEV database.
-- Collected from prisma/supabase-rls.sql, prisma/supabase-rls-policies-app.sql,
-- and prisma/scripts/* that ENABLE RLS / CREATE POLICY.
-- Safe to re-run: DROP POLICY IF EXISTS before each CREATE POLICY.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Enable RLS on core + feature tables (no-op if already enabled)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- from prisma/supabase-rls.sql
    'availability_slots', 'users', 'otp_codes', 'interview_email_logs',
    'candidate_application_drafts', 'time_entries', 'shifts', 'onboarding_tasks',
    'leave_requests', 'onboarding_documents', 'onboarding_completions',
    'signature_certificates', 'user_profiles', 'rbt_audit_logs', 'interviews',
    'rbt_documents', 'interview_notes', 'sessions', 'activity_logs',
    'rbt_profiles', 'interview_scorecards',
    -- from supabase-rls-policies-app.sql extras
    'rbt_messages', 'admin_notifications', 'session_notes', 'client_assignments',
    'scheduling_clients', 'org_nodes', 'training_sessions', 'training_bookings',
    'training_email_log', 'artemis_session_requests',
    'billing_cycles', 'billing_entries', 'billing_sessions', 'payroll_only_people',
    'billing_hours_confirmations', 'email_blast_campaigns', 'email_blast_send_logs',
    'terminations', 'offboarding_tasks', 'termination_documents',
    'rbt_schedule_assignments', 'rbt_pay_statements', 'rbt_pay_statement_sessions',
    'company_settings',
    -- client services / schedule / payroll / company docs
    'service_clients', 'service_client_bt_assignments', 'service_client_documents',
    'service_client_notes', 'client_access_logs', 'client_services_sessions',
    'client_service_breaks', 'client_rbt_breaks', 'service_client_status_history',
    'client_requirements', 'client_authorizations', 'client_authorization_lines',
    'client_tasks', 'client_communications', 'client_alerts',
    'client_consents', 'client_referral_checks',
    'schedule_import_batches', 'client_boroughs',
    'payroll_runs', 'payroll_run_entries',
    'company_documents', 'company_document_recipients',
    -- misc tables present after db push
    'otp_rate_limits', 'admin_availability', 'admin_availability_overrides',
    'admin_calendar_notes', 'admin_status', 'hr_document_tasks',
    'employee_document_folders', 'onboarding_quiz_attempts',
    'onboarding_quiz_certificates', 'oig_screening_logs',
    'interviewer_settings', 'interviewer_availability', 'interview_slots',
    'scheduling_exclusions', 'bcba_profiles', 'billing_profiles',
    'marketing_profiles', 'call_center_profiles', 'dev_teams', 'dev_team_members',
    'staff_hours_logs', 'employees', 'employee_roles', 'documents', 'credentials',
    'clients', 'payer_authorizations', 'clinical_service_logs',
    'supervision_events', 'compliance_alerts', 'audit_logs',
    'oauth_clients', 'oauth_authorization_codes', 'oauth_access_tokens',
    'schedule_allowed_user', 'therapist', 'schedule_client', 'session_slot',
    -- CRM roles (privilege-escalation surface; was missing from earlier lists)
    'user_crm_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) App-role full access policies (postgres) — from supabase-rls-policies-app.sql
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  app_role text := 'postgres';
  t text;
  pol_name text;
  tables text[] := ARRAY[
    'availability_slots', 'users', 'otp_codes', 'interview_email_logs',
    'candidate_application_drafts', 'time_entries', 'shifts', 'onboarding_tasks',
    'leave_requests', 'onboarding_documents', 'onboarding_completions',
    'signature_certificates', 'user_profiles', 'rbt_audit_logs', 'interviews',
    'rbt_documents', 'interview_notes', 'sessions', 'activity_logs',
    'rbt_profiles', 'interview_scorecards', 'rbt_messages', 'admin_notifications',
    'session_notes', 'client_assignments', 'scheduling_clients', 'org_nodes',
    'training_sessions', 'training_bookings', 'training_email_log',
    'artemis_session_requests', 'billing_cycles', 'billing_entries',
    'billing_sessions', 'payroll_only_people', 'billing_hours_confirmations',
    'email_blast_campaigns', 'email_blast_send_logs', 'terminations',
    'offboarding_tasks', 'termination_documents', 'rbt_schedule_assignments',
    'rbt_pay_statements', 'rbt_pay_statement_sessions', 'company_settings',
    'service_clients', 'service_client_bt_assignments', 'service_client_documents',
    'service_client_notes', 'client_access_logs', 'client_services_sessions',
    'client_service_breaks', 'client_rbt_breaks', 'service_client_status_history',
    'client_requirements', 'client_authorizations', 'client_authorization_lines',
    'client_tasks', 'client_communications', 'client_alerts',
    'client_consents', 'client_referral_checks',
    'schedule_import_batches', 'client_boroughs', 'payroll_runs',
    'payroll_run_entries', 'company_documents', 'company_document_recipients',
    'user_crm_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      pol_name := 'allow_app_' || replace(t, '.', '_');
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        pol_name, t, app_role
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Explicit service_role / postgres / block-anon policies
--    (pattern used by client-services, schedule, payroll, company-docs scripts)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'service_clients', 'service_client_bt_assignments', 'service_client_documents',
    'service_client_notes', 'client_access_logs', 'client_services_sessions',
    'client_service_breaks', 'client_rbt_breaks', 'service_client_status_history',
    'client_requirements', 'client_authorizations', 'client_authorization_lines',
    'client_tasks', 'client_communications', 'client_alerts',
    'client_consents', 'client_referral_checks',
    'rbt_schedule_assignments', 'schedule_import_batches', 'client_boroughs',
    'rbt_pay_statements', 'rbt_pay_statement_sessions',
    'payroll_runs', 'payroll_run_entries',
    'company_documents', 'company_document_recipients',
    'user_crm_roles'
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
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Catch-all: any remaining public table with RLS still off.
--    Enables RLS + the standard 3-policy pattern so a new model cannot
--    silently ship without policies (Supabase Security Advisor gap).
--    Skip supabase/prisma internals that live in public.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  skip text[] := ARRAY['_prisma_migrations'];
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
      AND NOT (c.relname = ANY (skip))
    ORDER BY c.relname
  LOOP
    RAISE NOTICE 'RLS catch-all: enabling on public.%', t;
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
  END LOOP;

  -- Tables that already have RLS but zero policies (deny-all for non-owners).
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND NOT (c.relname = ANY (skip))
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
    ORDER BY c.relname
  LOOP
    RAISE NOTICE 'RLS catch-all: adding 3-policy pattern on public.%', t;

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
  END LOOP;
END $$;

-- GO-LIVE (prod): Aaron runs `psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/rls/apply-rls.sql`
-- after a manual Supabase backup. Cursor must not apply this against prod.
-- Verify: anon/publishable key SELECT on user_crm_roles returns 0 rows.

