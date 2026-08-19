/**
 * Backfill service_clients.currentOwnerDept from STAGE_DEFAULT_OWNER_DEPT[stage]
 * wherever the column is null. Dry-run by default; refuse prod without --prod-confirm.
 *
 *   npm run crm:backfill-owner-dept
 *   npm run crm:backfill-owner-dept -- --confirm
 */
import { PrismaClient, type ClientStage } from '@prisma/client'
import { STAGE_DEFAULT_OWNER_DEPT } from '../lib/crm/stages'
import { assertWriteTarget } from '../lib/scripts/guard'

const prisma = new PrismaClient()

async function main() {
  const target = assertWriteTarget({ allowProd: true })

  const nullRows = await prisma.serviceClient.findMany({
    where: { currentOwnerDept: null, deletedAt: null },
    select: { id: true, clientCode: true, stage: true },
  })

  console.log(
    `[backfill-owner-dept] ${nullRows.length} client(s) with null currentOwnerDept${target.dryRun ? ' (dry-run)' : ''}`
  )

  let updated = 0
  for (const row of nullRows) {
    const dept = STAGE_DEFAULT_OWNER_DEPT[row.stage as ClientStage]
    if (!dept) {
      console.warn(`  skip ${row.clientCode}: no default for stage ${row.stage}`)
      continue
    }
    console.log(`  ${row.clientCode} ${row.stage} → ${dept}`)
    if (!target.dryRun) {
      await prisma.serviceClient.update({
        where: { id: row.id },
        data: { currentOwnerDept: dept },
      })
    }
    updated++
  }

  console.log(`[backfill-owner-dept] ${target.dryRun ? 'Would update' : 'Updated'}: ${updated}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
