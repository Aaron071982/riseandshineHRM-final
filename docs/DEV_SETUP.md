# Dev database setup (PHI-safe)

This repo’s Prisma migration history was **baselined against production**. Do **not** run `prisma migrate deploy` / `migrate dev` against a fresh database — early migrations reference tables they never create. Use **`prisma db push`** (via the scripts below) so `schema.prisma` builds the schema directly.

## Access boundary

A new developer receives:

- This **GitHub repo**
- The **dev** Supabase project only (`riseandshine-hrm-dev`, ref `gqfnqsxwoyrjphgcrzga`, region `ca-central-1`)

They must **never** receive:

- Production `DATABASE_URL` / `DIRECT_URL`
- Production Supabase service-role / secret keys
- Real Artemis exports, rosters, or any PHI

Real-PHI access requires a signed BAA first.

## 1. Create `.env.development` (git-ignored)

1. In Supabase → Project Settings → Database, copy the **URI** connection strings.
2. Use the **pooler** URL for `DATABASE_URL` and the **direct/session** URL (port `5432`) for `DIRECT_URL`.
3. If the DB password contains `@`, URL-encode it as `%40` inside the connection strings.
4. Copy [`.env.example`](../.env.example) → `.env.development` and fill values. Required at minimum:

```bash
DATABASE_URL=...          # must contain gqfnqsxwoyrjphgcrzga
DIRECT_URL=...            # same project, session/direct
DEV_SUPABASE_REF=gqfnqsxwoyrjphgcrzga
CLIENT_SERVICES_FULL_ACCESS_EMAILS=admin@example.com
CLIENT_SERVICES_ACCESS_CODE=20262027
ADMIN_FALLBACK_EMAIL=admin@example.com
SUPER_ADMIN_EMAILS=admin@example.com
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Seed and reset scripts **abort** unless `DATABASE_URL` contains `DEV_SUPABASE_REF`.

Client Services step-up uses `CLIENT_SERVICES_ACCESS_CODE` (dev default `20262027`) — never hardcode it in app code.
## 2. One-shot setup

```bash
npm install
npm run dev:setup
```

This runs: schema push → RLS apply → synthetic seed, then prints row counts.

Confirm in Supabase **Table Editor** that users/clients show `@example.com` / `SYNTH-*` only.

Then:

```bash
npm run dev
```

Log in as `admin@example.com` (local OTP fallback / allowlists from `.env.development`).

## 3. Individual commands

| Script | What it does |
|--------|----------------|
| `npm run db:push:dev` | `prisma db push` to **dev only** (ref guard) |
| `npm run db:rls:dev` | Apply [`prisma/rls/apply-rls.sql`](../prisma/rls/apply-rls.sql) |
| `npm run db:seed:dev` | Synthetic faker seed (`@example.com`) |
| `npm run db:reset:dev` | push → RLS → seed |

## 4. Schema clone fallback (rare)

If some role-gated feature behaves differently than prod because RLS was edited only in prod’s SQL editor and never landed in the repo:

```bash
export PROD_DIRECT_URL='postgresql://…'   # structure only; do not store in .env.development
bash scripts/clone-schema-to-dev.sh
npm run db:rls:dev
npm run db:seed:dev
```

`pg_dump --schema-only` — **zero rows**, no PHI. Prefer `db:push:dev` for day-to-day work.

## 5. Vercel (document only — do not change from this runbook)

| Environment | Database |
|-------------|----------|
| **Production** | Prod Supabase |
| **Preview** | Dev Supabase (`gqfnqsxwoyrjphgcrzga`) |

Set Preview `DATABASE_URL` / `DIRECT_URL` / Supabase keys to the **dev** project so PR previews never touch prod or real PHI.

## Safety

- [`prisma/seed-guard.ts`](../prisma/seed-guard.ts) — `assertDevTarget()` on seed
- [`scripts/dev-env-guard.sh`](../scripts/dev-env-guard.sh) — shared shell guard for push/RLS/reset
- Seed data is synthetic only; re-running clears prior `@example.com` / `SYNTH-*` rows first
