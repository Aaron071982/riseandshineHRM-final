#!/usr/bin/env bash
# Shared: load .env.development and abort unless DATABASE_URL targets the PHI-safe dev project.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env.development"
EXPECTED_REF="${DEV_SUPABASE_REF_OVERRIDE:-gqfnqsxwoyrjphgcrzga}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✋ Missing ${ENV_FILE}"
  echo "   Copy from .env.example, fill in the riseandshine-hrm-dev Supabase credentials,"
  echo "   and set DEV_SUPABASE_REF=${EXPECTED_REF}"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "✋ DATABASE_URL is unset in .env.development"
  exit 1
fi

# Prefer explicit ref; fall back to hardcoded project ref from the runbook.
DEV_REF="${DEV_SUPABASE_REF:-$EXPECTED_REF}"

HOST="$(node -e '
const u = process.env.DATABASE_URL || "";
try {
  const host = new URL(u).hostname;
  process.stdout.write(host || "unknown");
} catch {
  const part = u.split("@")[1]?.split("/")[0] || "unknown";
  process.stdout.write(part);
}
')"

echo "→ Target host: ${HOST}"

if [[ "$DATABASE_URL" != *"$DEV_REF"* ]]; then
  echo "✋ Refusing to run — DATABASE_URL does not contain the expected dev project ref."
  echo "   Target host: ${HOST}"
  echo "   Expected ref: ${DEV_REF}"
  exit 1
fi

echo "✓ Dev target confirmed (${DEV_REF})"
