#!/usr/bin/env bash
# Parity fallback: copy public schema structure from prod → dev (zero rows / no PHI).
# Use only when role-gated features behave differently in dev (RLS that exists only
# in prod's SQL editor and isn't in the repo). Default path is `npm run db:push:dev`.
#
# Requires PROD_DIRECT_URL in the environment (session-mode / direct Postgres URL).
# Never copies data — schema-only dump.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/dev-env-guard.sh"

if [[ -z "${PROD_DIRECT_URL:-}" ]]; then
  echo "✋ PROD_DIRECT_URL is required for schema clone (structure only)."
  echo "   Export it for this shell only — do not put it in .env.development."
  exit 1
fi

if [[ "$PROD_DIRECT_URL" == *"${DEV_SUPABASE_REF:-gqfnqsxwoyrjphgcrzga}"* ]]; then
  echo "✋ PROD_DIRECT_URL looks like the dev project — aborting."
  exit 1
fi

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "✋ DIRECT_URL (dev) is unset in .env.development"
  exit 1
fi

TMP_DIR="${ROOT}/prisma/.tmp"
mkdir -p "$TMP_DIR"
DUMP="${TMP_DIR}/prod-schema.sql"

echo "→ Dumping prod public schema (structure only)…"
pg_dump --schema-only --schema=public --no-owner --no-privileges \
  --dbname="$PROD_DIRECT_URL" \
  --file="$DUMP"

echo "→ Applying structure to DEV (${HOST})…"
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f "$DUMP"

echo "✓ Schema clone complete (no rows). Dump kept at prisma/.tmp/prod-schema.sql (gitignored)."
echo "  Next: npm run db:rls:dev && npm run db:seed:dev"
