/**
 * Verify appointed-hours payable policy against the 2026-07-31 Artemis file.
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
  console.log('Stay ≠ appointed:', clamp.sessionsHoursChanged)
  console.log('Date mismatch:', clamp.sessionsDateMismatch)
  console.log('Hours under stay:', clamp.hoursRemovedByClamp.toFixed(2))
  console.log('Hours over stay:', clamp.hoursOverAppointed.toFixed(2))

  const intisar = sessions.find(
    (s) =>
      s.providerName.toLowerCase().includes('intisar') &&
      s.actualStart?.getUTCMinutes() === 18 &&
      s.actualStart.getUTCHours() === 16
  )
  const amna = sessions.find(
    (s) =>
      s.providerName.toLowerCase().includes('amna habib') &&
      s.actualStart?.getUTCMinutes() === 13 &&
      s.actualStart.getUTCHours() === 14
  )
  const carly = sessions.find(
    (s) =>
      s.providerName.toLowerCase().includes('carly') &&
      s.actualStart?.getUTCMinutes() === 57 &&
      s.actualStart.getUTCHours() === 13
  )
  const quinton = sessions.find(
    (s) =>
      s.providerName.toLowerCase().includes('quinton') &&
      s.reviewFlag === REVIEW_FLAG.DATE_MISMATCH
  )

  const checks: [string, boolean][] = [
    ['259 RBT/BT sessions', sessions.length === 259],
    ['259 with all four times', clamp.sessionsWithAllTimes === 259],
    ['1 date mismatch', clamp.sessionsDateMismatch === 1],
    ['Intisar → 4.0h appointed', !!intisar && almost(intisar.actualMinutes / 60, 4.0)],
    [
      'Intisar stay logged as raw',
      !!intisar && almost(intisar.rawActualMinutes / 60, 4.0),
    ],
    [
      'Amna → appointed (not overlap-docked)',
      !!amna && amna.scheduledStart && amna.scheduledEnd
        ? almost(
            amna.actualMinutes,
            (amna.scheduledEnd.getTime() - amna.scheduledStart.getTime()) / 60000
          )
        : false,
    ],
    [
      'Amna Azaan appointed is 2:00 PM wall-clock (not +2h)',
      sessions.some(
        (s) =>
          s.providerName.toLowerCase().includes('amna habib') &&
          s.clientName.toLowerCase().includes('azaan') &&
          s.scheduledStart?.getUTCHours() === 14 &&
          s.scheduledEnd?.getUTCHours() === 18
      ),
    ],
    ['Carly → 3.0h appointed', !!carly && almost(carly.actualMinutes / 60, 3.0)],
    ['Quinton date mismatch flagged', !!quinton],
    [
      'Quinton still pays appointed hours',
      !!quinton &&
        quinton.scheduledStart &&
        quinton.scheduledEnd &&
        almost(
          quinton.actualMinutes,
          (quinton.scheduledEnd.getTime() - quinton.scheduledStart.getTime()) / 60000
        ) &&
        quinton.clampApplied,
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

  if (intisar) {
    console.log(
      '  Intisar payable:',
      (intisar.actualMinutes / 60).toFixed(4),
      'h | stay:',
      (intisar.rawActualMinutes / 60).toFixed(4),
      'h'
    )
  }
  if (amna) {
    console.log(
      '  Amna payable:',
      (amna.actualMinutes / 60).toFixed(4),
      'h | stay:',
      (amna.rawActualMinutes / 60).toFixed(4),
      'h'
    )
  }
  if (carly) {
    console.log(
      '  Carly payable:',
      (carly.actualMinutes / 60).toFixed(4),
      'h | stay:',
      (carly.rawActualMinutes / 60).toFixed(4),
      'h'
    )
  }
  if (quinton) {
    console.log(
      '  Quinton:',
      quinton.reviewFlag,
      '| payable',
      (quinton.actualMinutes / 60).toFixed(2),
      'h | sched UTC',
      quinton.scheduledStart?.toISOString(),
      '| actual UTC',
      quinton.actualStart?.toISOString()
    )
  }

  if (failed > 0) process.exit(1)
  console.log('\nVerification passed against', path)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
