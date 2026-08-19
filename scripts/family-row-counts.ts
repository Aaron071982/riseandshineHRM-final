/**
 * Snapshot / compare row counts on family-related tables.
 * Read-only. Use before and after a migration to catch unexpected mass change.
 *
 *   dotenv -e .env.development -- tsx scripts/family-row-counts.ts
 *   dotenv -e .env.development -- tsx scripts/family-row-counts.ts --snapshot /tmp/before.json
 *   dotenv -e .env.development -- tsx scripts/family-row-counts.ts --compare /tmp/before.json
 */
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { FAMILY_SOFT_DELETE_TABLES } from '../lib/crm/softDelete'
import { assertWriteTarget } from '../lib/scripts/guard'

const prisma = new PrismaClient()

type Counts = Record<string, { total: number; live: number; deleted: number }>

async function collect(): Promise<Counts> {
  const out: Counts = {}
  for (const table of FAMILY_SOFT_DELETE_TABLES) {
    const rows = await prisma.$queryRawUnsafe<
      { total: bigint; live: bigint; deleted: bigint }[]
    >(
      `SELECT
         COUNT(*)::bigint AS total,
         COUNT(*) FILTER (WHERE "deletedAt" IS NULL)::bigint AS live,
         COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)::bigint AS deleted
       FROM public.${table}`
    )
    const r = rows[0]
    out[table] = {
      total: Number(r?.total ?? 0),
      live: Number(r?.live ?? 0),
      deleted: Number(r?.deleted ?? 0),
    }
  }
  return out
}

function print(counts: Counts, title: string) {
  console.log(`═══ ${title} ═══`)
  for (const [table, c] of Object.entries(counts)) {
    console.log(
      `  ${table.padEnd(36)} total=${c.total}  live=${c.live}  deleted=${c.deleted}`
    )
  }
}

async function main() {
  assertWriteTarget({ allowProd: true })

  const snapshotIdx = process.argv.indexOf('--snapshot')
  const compareIdx = process.argv.indexOf('--compare')
  const counts = await collect()
  print(counts, 'Family table counts')

  if (snapshotIdx >= 0) {
    const path = process.argv[snapshotIdx + 1]
    if (!path) {
      console.error('Usage: --snapshot <file.json>')
      process.exit(1)
    }
    fs.writeFileSync(
      path,
      JSON.stringify({ takenAt: new Date().toISOString(), counts }, null, 2)
    )
    console.log(`\nWrote snapshot ${path}`)
  }

  if (compareIdx >= 0) {
    const path = process.argv[compareIdx + 1]
    if (!path || !fs.existsSync(path)) {
      console.error('Usage: --compare <file.json> (file must exist)')
      process.exit(1)
    }
    const prev = JSON.parse(fs.readFileSync(path, 'utf8')) as {
      counts: Counts
    }
    console.log('\n═══ Deltas vs snapshot ═══')
    let changed = false
    for (const table of FAMILY_SOFT_DELETE_TABLES) {
      const a = prev.counts[table] ?? { total: 0, live: 0, deleted: 0 }
      const b = counts[table]
      const dt = b.total - a.total
      const dl = b.live - a.live
      const dd = b.deleted - a.deleted
      if (dt || dl || dd) {
        changed = true
        console.log(
          `  ${table}: total ${dt >= 0 ? '+' : ''}${dt}  live ${dl >= 0 ? '+' : ''}${dl}  deleted ${dd >= 0 ? '+' : ''}${dd}`
        )
      }
    }
    if (!changed) console.log('  (no count changes)')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
