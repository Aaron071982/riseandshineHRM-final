#!/usr/bin/env bash
# Guarded reset: push schema → apply RLS → seed synthetic data on the DEV project only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/dev-env-guard.sh"

cd "$ROOT"
bash "${ROOT}/scripts/dev-db-push.sh"
bash "${ROOT}/scripts/dev-apply-rls.sh"
npx dotenv -e .env.development -- prisma db seed
echo "✓ Dev DB reset complete (push + RLS + seed)"
