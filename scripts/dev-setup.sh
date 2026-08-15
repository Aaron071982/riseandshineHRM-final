#!/usr/bin/env bash
# One-shot: push schema, apply RLS, seed synthetic data; print row counts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/dev-env-guard.sh"

cd "$ROOT"
bash "${ROOT}/scripts/dev-db-push.sh"
bash "${ROOT}/scripts/dev-apply-rls.sh"
npx dotenv -e .env.development -- prisma db seed

echo ""
echo "═══ Dev setup row counts ═══"
npx dotenv -e .env.development -- tsx -e "
import { PrismaClient } from '@prisma/client'
import { assertDevTarget } from './prisma/seed-guard'
assertDevTarget()
const prisma = new PrismaClient()
const counts = {
  users: await prisma.user.count(),
  rbtProfiles: await prisma.rBTProfile.count(),
  serviceClients: await prisma.serviceClient.count(),
  scheduleAssignments: await prisma.rbtScheduleAssignment.count(),
  onboardingDocuments: await prisma.onboardingDocument.count(),
  interviews: await prisma.interview.count(),
  trainingSessions: await prisma.trainingSession.count(),
  timeEntries: await prisma.timeEntry.count(),
  orgNodes: await prisma.orgNode.count(),
}
console.table(counts)
await prisma.\$disconnect()
"
echo "✓ npm run dev:setup finished — confirm Table Editor shows @example.com only"
