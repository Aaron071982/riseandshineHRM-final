-- Align Postgres enum with prisma/schema.prisma enum RBTStatus.
-- Run once on Supabase / Postgres if you see:
--   invalid input value for enum "RBTStatus": "ONBOARDING_COMPLETED"
-- when using statuses that exist in Prisma but were never added in SQL.
--
-- PostgreSQL 15+ (Supabase): IF NOT EXISTS avoids errors on re-run.
-- Older PG: use plain ADD VALUE and ignore duplicate errors.

ALTER TYPE "RBTStatus" ADD VALUE IF NOT EXISTS 'ONBOARDING_COMPLETED';
