#!/usr/bin/env bash
# Apply consolidated RLS policies to the PHI-safe dev database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/dev-env-guard.sh"

SQL_FILE="${ROOT}/prisma/rls/apply-rls.sql"
if [[ ! -f "$SQL_FILE" ]]; then
  echo "✋ Missing ${SQL_FILE}"
  exit 1
fi

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "✋ DIRECT_URL is unset in .env.development (needed for psql)"
  exit 1
fi

cd "$ROOT"

if command -v psql >/dev/null 2>&1; then
  echo "→ Applying RLS via psql…"
  psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
else
  echo "→ psql not found; applying RLS via Prisma \$executeRaw…"
  npx dotenv -e .env.development -- tsx -e "
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { assertDevTarget } from './prisma/seed-guard'

assertDevTarget()
const sql = readFileSync('./prisma/rls/apply-rls.sql', 'utf8')
const prisma = new PrismaClient()
await prisma.\$executeRawUnsafe(sql)
await prisma.\$disconnect()
console.log('✓ RLS applied via Prisma')
"
fi

echo "✓ RLS applied to dev"
