-- Disable Row Level Security (RLS) on all public tables.
-- Run this in Supabase SQL Editor if you enabled RLS (supabase-rls.sql) and the app
-- can no longer load data (e.g. "Data could not be loaded", 403 on audit logs, zeros everywhere).
-- Your DATABASE_URL role likely does not have BYPASSRLS, so RLS was blocking reads.
-- After running this, the app will be able to read/write again. You can re-enable RLS later
-- once the connection role has BYPASSRLS (Dashboard → Database → Roles) or per-table policies.

ALTER TABLE public.availability_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_application_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_completions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbt_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecards DISABLE ROW LEVEL SECURITY;
