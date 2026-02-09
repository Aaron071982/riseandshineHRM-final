-- Enable Row Level Security (RLS) on all public tables.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Use the SAME Supabase project as your production DATABASE_URL.
--
-- IMPORTANT: Only run this if the role in your DATABASE_URL has "Bypass RLS" enabled
-- (Supabase Dashboard → Database → Roles → your role). If you run this without
-- BYPASSRLS, the app will not be able to read data ("Data could not be loaded",
-- 403 on audit logs, zeros). If that happens, run prisma/supabase-rls-rollback.sql
-- in SQL Editor to disable RLS and restore data loading.
--
-- Tables from Supabase Performance/Security linter (RLS disabled in public).

ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_application_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecards ENABLE ROW LEVEL SECURITY;

-- If you get 403 on admin routes (e.g. audit logs) after enabling RLS, the role in DATABASE_URL
-- may not have BYPASSRLS. Either enable "Bypass RLS" for that role in Dashboard → Database → Roles,
-- or run the block below so the app can still read sessions and users.
-- Replace 'postgres' with the actual role from: SELECT current_user; (in SQL Editor using your app's connection).
/*
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'allow_app_sessions') THEN
    EXECUTE 'CREATE POLICY allow_app_sessions ON public.sessions FOR ALL TO postgres USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'allow_app_users') THEN
    EXECUTE 'CREATE POLICY allow_app_users ON public.users FOR ALL TO postgres USING (true) WITH CHECK (true)';
  END IF;
END $$;
*/
