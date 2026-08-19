/**
 * Backfill full requirement catalog for all live clients.
 *
 *   dotenv -e .env.development -- tsx scripts/backfill-client-requirements.ts
 *   dotenv -e .env.development -- tsx scripts/backfill-client-requirements.ts --confirm
 *   dotenv -e .env -- tsx scripts/backfill-client-requirements.ts --confirm --prod-confirm
 */
import { PrismaClient } from '@prisma/client'
import { assertWriteTarget } from '../lib/scripts/guard'
import { ensureClientRequirements } from '../lib/crm/ensureRequirements'

const prisma = new PrismaClient()

async function main() {
  const target = assertWriteTarget({ allowProd: true })

  const clients = await prisma.serviceClient.findMany({
    where: { deletedAt: null },
    select: { id: true, clientCode: true },
    orderBy: { clientCode: 'asc' },
  })

  let created = 0
  let updated = 0

  for (const client of clients) {
    if (target.dryRun) {
      const count = await prisma.clientRequirement.count({
        where: { serviceClientId: client.id, deletedAt: null },
      })
      console.log(`  ${client.clientCode}: ${count} requirements (dry-run)`)
      continue
    }

    const result = await ensureClientRequirements(client.id)
    created += result.created
    updated += result.updated
    if (result.created > 0 || result.updated > 0) {
      console.log(
        `  ${client.clientCode}: +${result.created} created, ${result.updated} metadata fixed`
      )
    }
  }

  console.log('\n═══ Client requirements backfill ═══')
  console.log(`  clients: ${clients.length}`)
  console.log(`  created: ${created}`)
  console.log(`  metadata fixed: ${updated}`)
  console.log(target.dryRun ? '  (dry-run — no writes)' : '  writes applied')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
