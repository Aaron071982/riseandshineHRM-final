#!/usr/bin/env bash
# Push prisma/schema.prisma to the PHI-safe dev Supabase project (never prod).
# Uses `prisma db push` — do NOT run migrate deploy/dev against this fresh DB
# (migration history was baselined against prod and will not recreate tables from empty).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/dev-env-guard.sh"

cd "$ROOT"
echo "→ prisma db push (schema.prisma → dev)"
npx dotenv -e .env.development -- prisma db push --skip-generate
echo "→ prisma generate"
npx prisma generate
echo "✓ Schema pushed + client generated"
