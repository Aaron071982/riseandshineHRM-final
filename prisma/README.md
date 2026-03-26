# Prisma

- **schema.prisma** – Source of truth for the database schema.
- **seed.ts** – Main seed script (run via `npx prisma db seed`). Use for initial or reference data.
- **Migrations** – Apply schema changes with `npx prisma migrate deploy` (production) or `migrate dev` (development).
- **supabase-migrations.sql** / Supabase RLS – Use when deploying to Supabase; keep in sync with schema and RLS policies.
- **scripts-archive/** – One-off scripts (fix-onboarding-documents, remove-duplicate-documents, seed-onboarding-documents). Do not run without review.
