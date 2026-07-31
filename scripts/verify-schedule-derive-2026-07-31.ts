/**
 * Verify weekly schedule derivation against 2026-07-31 Artemis file.
 * Usage: npx tsx scripts/verify-schedule-derive-2026-07-31.ts [path]
 */
import fs from 'fs'
import { deriveWeeklySchedulesFromArtemis } from '../lib/schedule-import/deriveWeekly'

const DEFAULT =
  '/Users/aaron/Downloads/Session reconciliation report-2026-07-31-08-00-47.xlsx'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmt(m: number) {
  const h = Math.floor(m / 60)
  const mm = m % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${ap}`
}

async function main() {
  const path = process.argv[2] || DEFAULT
  if (!fs.existsSync(path)) {
    console.error('File not found:', path)
    process.exit(1)
  }

  const result = await deriveWeeklySchedulesFromArtemis(fs.readFileSync(path))
  console.log('Providers:', result.stats.providerCount)
  console.log('Slots:', result.stats.slotCount)
  console.log('Clients:', result.clientNames.length)

  const ahmed = result.providers.find((p) =>
    p.providerName.toLowerCase().includes('ahmed abdelkhalek')
  )
  const ammar = result.providers.find((p) => p.providerName.toLowerCase().includes('ammar taj'))
  const asiyah = result.providers.find((p) =>
    p.providerName.toLowerCase().includes('asiyah malik')
  )

  const ahmedWeekdays =
    ahmed?.slots.filter(
      (s) =>
        s.dayOfWeek >= 1 &&
        s.dayOfWeek <= 5 &&
        s.startMin === 7 * 60 &&
        s.endMin === 11 * 60 &&
        s.clientName.toLowerCase().includes('umer')
    ) ?? []

  const ammarWeekend =
    ammar?.slots.filter(
      (s) =>
        (s.dayOfWeek === 0 || s.dayOfWeek === 6) &&
        s.startMin === 11 * 60 &&
        s.endMin === 15 * 60 &&
        s.clientName.toLowerCase().includes('azaan')
    ) ?? []

  const asiyahWed = asiyah?.slots.filter(
    (s) => s.dayOfWeek === 3 && s.clientName.toLowerCase().includes('mukhlisa')
  )

  const checks: [string, boolean][] = [
    ['29 providers', result.stats.providerCount === 29],
    ['Ahmed Mon-Fri 7-11 Umer (5 slots)', ahmedWeekdays.length === 5],
    ['Ammar Sat+Sun 11-3 Azaan (2 slots)', ammarWeekend.length === 2],
    ['Asiyah Wed Mukhlisa collapsed to 1', (asiyahWed?.length ?? 0) === 1],
  ]

  let failed = 0
  for (const [label, ok] of checks) {
    if (ok) console.log('ok:', label)
    else {
      console.error('FAIL:', label)
      failed++
    }
  }

  if (ahmed) {
    console.log(
      '  Ahmed slots:',
      ahmed.slots.map((s) => `${DAYS[s.dayOfWeek]} ${fmt(s.startMin)}-${fmt(s.endMin)} ${s.clientName}`)
    )
  }
  if (ammar) {
    console.log(
      '  Ammar slots:',
      ammar.slots.map((s) => `${DAYS[s.dayOfWeek]} ${fmt(s.startMin)}-${fmt(s.endMin)} ${s.clientName}`)
    )
  }
  if (asiyahWed) {
    console.log(
      '  Asiyah Wed Mukhlisa:',
      asiyahWed.map((s) => `${fmt(s.startMin)}-${fmt(s.endMin)} n=${s.occurrenceCount}`)
    )
  }

  if (failed) process.exit(1)
  console.log('\nVerification passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
