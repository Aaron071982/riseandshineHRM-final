-- Enable Row Level Security (RLS) on all public tables.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Use the SAME Supabase project as your production DATABASE_URL.
--
-- IMPORTANT: Either (1) ensure the role in your DATABASE_URL has "Bypass RLS" enabled
-- (Supabase Dashboard → Database → Roles → your role), or (2) after enabling RLS, run
-- prisma/supabase-rls-policies-app.sql in SQL Editor so the app can read/write (e.g. interview notes).
-- If you already enabled RLS and see 403/500 (e.g. interview notes not saving), run
-- supabase-rls-policies-app.sql once, or run supabase-rls-rollback.sql to disable RLS.
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

-- If you get 403/500 after enabling RLS (e.g. audit logs, interview notes not saving), run
-- prisma/supabase-rls-policies-app.sql in SQL Editor to add allow_app_* policies for all tables.
