/**
 * Backfill service_clients.currentOwnerDept from STAGE_DEFAULT_OWNER_DEPT[stage]
 * wherever the column is null. Dev-first — refuse prod unless --allow-prod.
 *
 *   npm run crm:backfill-owner-dept
 *   npm run crm:backfill-owner-dept -- --dry-run
 */
import { PrismaClient, type ClientStage } from '@prisma/client'
import { STAGE_DEFAULT_OWNER_DEPT } from '../lib/crm/stages'

const prisma = new PrismaClient()

function isProdDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return (
    lower.includes('yhxcqxivimjulxpchmxu') ||
    lower.includes('prod') ||
    process.env.VERCEL_ENV === 'production'
  )
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const allowProd = process.argv.includes('--allow-prod')
  const dbUrl = process.env.DATABASE_URL

  if (isProdDatabaseUrl(dbUrl) && !allowProd) {
    console.error(
      '[backfill-owner-dept] Refusing to run against a production-looking DB. Pass --allow-prod to override.'
    )
    process.exit(1)
  }

  const nullRows = await prisma.serviceClient.findMany({
    where: { currentOwnerDept: null },
    select: { id: true, clientCode: true, stage: true },
  })

  console.log(
    `[backfill-owner-dept] ${nullRows.length} client(s) with null currentOwnerDept${dryRun ? ' (dry-run)' : ''}`
  )

  let updated = 0
  for (const row of nullRows) {
    const dept = STAGE_DEFAULT_OWNER_DEPT[row.stage as ClientStage]
    if (!dept) {
      console.warn(`  skip ${row.clientCode}: no default for stage ${row.stage}`)
      continue
    }
    console.log(`  ${row.clientCode} ${row.stage} → ${dept}`)
    if (!dryRun) {
      await prisma.serviceClient.update({
        where: { id: row.id },
        data: { currentOwnerDept: dept },
      })
    }
    updated++
  }

  console.log(`[backfill-owner-dept] ${dryRun ? 'Would update' : 'Updated'}: ${updated}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
