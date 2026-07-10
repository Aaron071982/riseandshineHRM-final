-- Align Postgres enum with prisma/schema.prisma enum RBTStatus.
-- Run once on Supabase / Postgres if you see:
--   invalid input value for enum "RBTStatus": "FIRED"

ALTER TYPE "RBTStatus" ADD VALUE IF NOT EXISTS 'FIRED';
