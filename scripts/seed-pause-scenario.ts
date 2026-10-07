/**
 * Seeds the "Pause (12 clients)" schedule scenario. Only writes to schedule_scenarios;
 * live schedule assignments and client records are not touched. Idempotent by name.
 *
 *   npx tsx scripts/seed-pause-scenario.ts           # preview
 *   npx tsx scripts/seed-pause-scenario.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { EMPTY_SCENARIO_CHANGES, scenarioPauseClient } from '../lib/schedule/scenario'

const NAME = 'Pause (12 clients)'

const NOTES = [
  'Medicaid pause list.',
  'Notices sent Monday: Anabia Amin, Melissa Seherish.',
  'Drafted: Alayna Tahreen.',
  'Not yet sent: Anabia Akter, Mecca Shaaban, Faraz Anwar, Mukhlisa Khurramova, Abdul Wahab, Jencarlos Rodriguez, Diar Sata (Emblem Medicaid), Ali Tariq (Anthem Medicaid).',
  'Aaban Saad never started: send the waitlist version.',
].join('\n')

const CLIENT_IDS = [
  'cmsywtdr500ifn2ssbp8pawft',
  'cmsywt9sn00d9n2sswryqambf',
  'cmspcid7i0001kq7b5g3z3x11',
  'cmsl3ukcx005uvc5tp4jpl9n5',
  'cmsywt8ir00bbn2ssy8pbqbrb',
  'cmsywtb1c00f7n2ssq1zjc3fl',
  'cmspdbpfq0005p4m4lg86pcgp',
  'cmsywt8sy00btn2ss77yww3yo',
  'cmsl3ujl20045vc5ttwhf3nqy',
  'cmsl3univ00bhvc5tv1g1kfc5',
  'cmsywtar500epn2ssr2rad31n',
  'cmsywt35j0047n2ssaue3dj7c',
]

async function main() {
  const apply = process.argv.includes('--apply')
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.scheduleScenario.findFirst({ where: { name: NAME, deletedAt: null } })
    if (existing) {
      console.log(`"${NAME}" already exists (${existing.id}); nothing to do.`)
      return
    }

    const rows = await prisma.serviceClient.findMany({
      where: { id: { in: CLIENT_IDS } },
      select: { id: true, firstName: true, lastName: true },
    })
    const missing = CLIENT_IDS.filter((id) => !rows.some((r) => r.id === id))
    if (missing.length) throw new Error(`Clients not found: ${missing.join(', ')}`)

    let changes = EMPTY_SCENARIO_CHANGES
    for (const id of CLIENT_IDS) {
      const r = rows.find((x) => x.id === id)!
      changes = scenarioPauseClient(changes, { id: r.id, name: `${r.firstName} ${r.lastName}`.trim() })
    }
    console.log(`Pausing ${changes.pausedClients.length} clients:`)
    for (const p of changes.pausedClients) console.log(`  - ${p.name}`)

    if (!apply) {
      console.log('\nPreview only. Re-run with --apply to create the scenario.')
      return
    }
    const created = await prisma.scheduleScenario.create({ data: { name: NAME, notes: NOTES, changes } })
    console.log(`\nCreated scenario ${created.id}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
