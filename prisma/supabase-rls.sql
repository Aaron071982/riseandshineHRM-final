-- Enable Row Level Security (RLS) on all public tables.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Use the SAME Supabase project as your production DATABASE_URL.
--
-- IMPORTANT: The app uses Prisma with a direct Postgres connection (DATABASE_URL).
-- In Supabase, the role used by DATABASE_URL (e.g. pooler or postgres) typically has
-- BYPASSRLS. If so, enabling RLS here does NOT change Prisma's behavior; it only
-- restricts Supabase PostgREST/API access. If your connection role does NOT have
-- BYPASSRLS, you must add policies that allow that role to perform needed operations,
-- or use a role with BYPASSRLS for the app.
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
