/**
 * Migrate board-only session_slot rows into rbt_schedule_assignments
 * as provisional BOARD_MIGRATION / PENDING (not live).
 *
 *   dotenv -e .env.development -- tsx scripts/migrate-board-slots.ts
 *   dotenv -e .env.development -- tsx scripts/migrate-board-slots.ts --confirm --report /tmp/board-mig.json
 *
 * Prod (Aaron only, after backup + family-counts snapshot):
 *   dotenv -e .env -- tsx scripts/migrate-board-slots.ts --prod-confirm --confirm --report /tmp/board-mig-prod.json
 */
import { PrismaClient } from '@prisma/client'
import { PLATFORM_OWNER_EMAIL } from '../lib/constants'
import { assertWriteTarget } from '../lib/scripts/guard'
import { applyBoardMigration } from '../lib/schedule/applyBoardMigration'

const prisma = new PrismaClient()

async function resolveCreatedBy(): Promise<string> {
  const owner = await prisma.user.findFirst({
    where: { email: { equals: PLATFORM_OWNER_EMAIL, mode: 'insensitive' } },
    select: { id: true },
  })
  if (owner) return owner.id
  const any = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!any) throw new Error('No User row to use as createdBy')
  return any.id
}

async function main() {
  const target = assertWriteTarget({ allowProd: true })
  const reportIdx = process.argv.indexOf('--report')
  const reportPath =
    reportIdx >= 0 ? process.argv[reportIdx + 1] : '/tmp/board-slot-migration-report.json'

  const createdByUserId = await resolveCreatedBy()
  console.log(`→ createdBy user: ${createdByUserId}`)
  console.log(`→ report: ${reportPath}`)

  const result = await applyBoardMigration({
    createdByUserId,
    dryRun: target.dryRun,
    reportPath,
  })

  console.log('\n═══ Board-slot migration ═══')
  console.log(`  total slots classified: ${result.rows.length}`)
  console.log(`  mirror (Artemis):       ${result.counts.mirror}`)
  console.log(`  already migrated:       ${result.counts.already_migrated}`)
  console.log(`  already represented:    ${result.counts.already_represented}`)
  console.log(`  unresolved RBT:         ${result.counts.unresolved_rbt}`)
  console.log(`  to migrate (provisional): ${result.counts.migrate}`)
  console.log(
    target.dryRun
      ? `  inserted: 0 (dry-run)`
      : `  inserted: ${result.inserted}`
  )
  console.log(`  report written: ${result.reportPath}`)

  const conflicts = result.rows.filter(
    (r) => r.disposition === 'migrate' && r.conflictAssignmentIds.length > 0
  )
  if (conflicts.length) {
    console.log(`\n  ⚠ ${conflicts.length} provisional row(s) conflict with an active assignment (different RBT).`)
  }
  const unresolved = result.rows.filter((r) => r.disposition === 'unresolved_rbt')
  if (unresolved.length) {
    console.log(`  ⚠ ${unresolved.length} slot(s) left in the report with no RBT match (not inserted).`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
