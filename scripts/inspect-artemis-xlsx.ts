/**
 * Inspect Artemis session reconciliation xlsx — uses the same parser as billing upload.
 * Usage: npx tsx scripts/inspect-artemis-xlsx.ts [path-to-xlsx]
 */
import { readFileSync } from 'fs'
import { parseArtemisWorkbook } from '../lib/billing/artemisParser'
import type { ArtemisSessionStatusKey } from '../lib/billing/sessionStatus'

const EXPECTED_HOURS: Partial<Record<ArtemisSessionStatusKey, number>> = {
  scheduled: 476,
  incomplete: 448,
  completed: 67.5,
  ready_to_bill: 81,
  in_progress: 31.5,
  cancelled: 130,
  deleted: 522,
}

async function main() {
  const path =
    process.argv[2] ??
    '/Users/aaron/Downloads/Session reconciliation report-2026-06-17-17-26-38.xlsx'
  const buffer = readFileSync(path)
  const result = await parseArtemisWorkbook(buffer)

  console.log('Parser stats:', result.stats)
  console.log(
    'Date range:',
    result.detectedDateRange.min?.toISOString().slice(0, 10),
    '–',
    result.detectedDateRange.max?.toISOString().slice(0, 10)
  )
  console.log('Payroll providers:', result.payrollGroups.length)
  console.log('Excluded providers:', result.excludedGroups.length)

  console.log('\nHours by status:')
  const hoursByStatus = result.stats.hoursByStatus ?? {}
  for (const [key, hours] of Object.entries(hoursByStatus).sort((a, b) => a[0].localeCompare(b[0]))) {
    const expected = EXPECTED_HOURS[key as ArtemisSessionStatusKey]
    const delta = expected != null ? hours - expected : null
    const flag =
      delta != null && Math.abs(delta) > 2 ? ' ⚠️' : delta != null ? ' ✓' : ''
    console.log(
      `  ${key}: ${hours.toFixed(1)}h${expected != null ? ` (expected ~${expected}h, Δ${delta!.toFixed(1)})` : ''}${flag}`
    )
  }
}

main().catch(console.error)
