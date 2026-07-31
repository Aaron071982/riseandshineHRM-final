/**
 * Verify schedule-window clamp against the 2026-07-31 Artemis file.
 * Usage: npx tsx scripts/verify-clamp-2026-07-31.ts [path-to-xlsx]
 */
import fs from 'fs'
import { parseArtemisWorkbook } from '../lib/billing/artemisParser'
import { REVIEW_FLAG } from '../lib/billing/scheduleClamp'

const DEFAULT =
  '/Users/aaron/Downloads/Session reconciliation report-2026-07-31-08-00-47.xlsx'

function almost(a: number, b: number, eps = 0.02) {
  return Math.abs(a - b) < eps
}

async function main() {
  const path = process.argv[2] || DEFAULT
  if (!fs.existsSync(path)) {
    console.error('File not found:', path)
    process.exit(1)
  }

  const result = await parseArtemisWorkbook(fs.readFileSync(path))
  const sessions = result.payrollGroups.flatMap((g) => g.sessions)
  const clamp = result.stats.clamp!

  console.log('Payroll RBT/BT sessions:', sessions.length)
  console.log('With all four times:', clamp.sessionsWithAllTimes)
  console.log('Hours changed by clamp:', clamp.sessionsHoursChanged)
  console.log('Date mismatch:', clamp.sessionsDateMismatch)
  console.log('Hours removed:', clamp.hoursRemovedByClamp.toFixed(2))

  const intisar = sessions.find(
    (s) =>
      s.providerName.toLowerCase().includes('intisar') &&
      s.actualStart?.getMinutes() === 18 &&
      s.actualStart.getHours() === 16
  )
  const amna = sessions.find(
    (s) =>
      s.providerName.toLowerCase().includes('amna habib') &&
      s.actualStart?.getMinutes() === 13 &&
      s.actualStart.getHours() === 14
  )
  const carly = sessions.find(
    (s) =>
      s.providerName.toLowerCase().includes('carly') &&
      s.actualStart?.getMinutes() === 57 &&
      s.actualStart.getHours() === 13
  )
  const quinton = sessions.find(
    (s) =>
      s.providerName.toLowerCase().includes('quinton') &&
      s.reviewFlag === REVIEW_FLAG.DATE_MISMATCH
  )

  const checks: [string, boolean][] = [
    ['259 RBT/BT sessions', sessions.length === 259],
    ['259 with all four times', clamp.sessionsWithAllTimes === 259],
    ['31 sessions hours changed', clamp.sessionsHoursChanged === 31],
    ['1 date mismatch', clamp.sessionsDateMismatch === 1],
    ['Intisar → 3.7h', !!intisar && almost(intisar.actualMinutes / 60, 3.7)],
    ['Amna → 3.78h', !!amna && almost(amna.actualMinutes / 60, 3.78)],
    ['Carly → 3.0h', !!carly && almost(carly.actualMinutes / 60, 3.0)],
    ['Quinton date mismatch flagged', !!quinton],
    [
      'Quinton uses raw (not clamped across dates)',
      !!quinton && quinton.actualMinutes === quinton.rawActualMinutes && !quinton.clampApplied,
    ],
  ]

  let failed = 0
  for (const [label, ok] of checks) {
    if (ok) console.log('ok:', label)
    else {
      console.error('FAIL:', label)
      failed++
    }
  }

  if (intisar) console.log('  Intisar:', (intisar.actualMinutes / 60).toFixed(4), 'h')
  if (amna) console.log('  Amna:', (amna.actualMinutes / 60).toFixed(4), 'h')
  if (carly) console.log('  Carly:', (carly.actualMinutes / 60).toFixed(4), 'h')
  if (quinton) {
    console.log(
      '  Quinton:',
      quinton.reviewFlag,
      '| sched',
      quinton.scheduledStart?.toLocaleString(),
      '| actual',
      quinton.actualStart?.toLocaleString()
    )
  }

  if (failed > 0) process.exit(1)
  console.log('\nVerification passed against', path)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
