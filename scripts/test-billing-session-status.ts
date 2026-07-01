/**
 * Regression checks for Artemis session status normalization and payable hours.
 * Usage: npx tsx scripts/test-billing-session-status.ts
 */
import {
  ARTEMIS_STATUS,
  computePayableHours,
  countPayableSessions,
  normalizeArtemisStatus,
  sessionMatchesStatusFilter,
} from '../lib/billing/sessionStatus'
import { formatCalendarDate, parseCalendarDate } from '../lib/billing/calendarDate'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('FAIL:', message)
    process.exit(1)
  }
  console.log('ok:', message)
}

const payable = [ARTEMIS_STATUS.COMPLETED, ARTEMIS_STATUS.READY_TO_BILL]

// Parser stores snake_case keys; Artemis exports use spaced labels
assert(
  normalizeArtemisStatus('ready_to_bill') === ARTEMIS_STATUS.READY_TO_BILL,
  'ready_to_bill normalizes'
)
assert(
  normalizeArtemisStatus('Ready to Bill') === ARTEMIS_STATUS.READY_TO_BILL,
  'Ready to Bill normalizes'
)
assert(
  normalizeArtemisStatus('in_progress') === ARTEMIS_STATUS.IN_PROGRESS,
  'in_progress normalizes'
)
assert(
  normalizeArtemisStatus('In Progress') === ARTEMIS_STATUS.IN_PROGRESS,
  'In Progress normalizes'
)
assert(normalizeArtemisStatus('completed') === ARTEMIS_STATUS.COMPLETED, 'completed normalizes')

const sessions = [
  { sessionStatus: 'completed', actualMinutes: 240 },
  { sessionStatus: 'ready_to_bill', actualMinutes: 240 },
  { sessionStatus: 'ready_to_bill', actualMinutes: 300 },
  { sessionStatus: 'incomplete', actualMinutes: 60 },
]

assert(
  computePayableHours(sessions, payable) === 13,
  'payable hours include ready_to_bill sessions (13h)'
)
assert(countPayableSessions(sessions, payable) === 3, 'payable session count is 3')
assert(
  sessionMatchesStatusFilter('ready_to_bill', ARTEMIS_STATUS.READY_TO_BILL),
  'filter matches stored key'
)
assert(
  sessionMatchesStatusFilter('Ready to Bill', ARTEMIS_STATUS.READY_TO_BILL),
  'filter matches Artemis label'
)

// ExcelJS returns DOS as UTC midnight — must not shift to previous calendar day
const excelDos = new Date('2026-06-15T00:00:00.000Z')
const parsedDos = parseCalendarDate(excelDos)
assert(parsedDos?.toISOString() === '2026-06-15T00:00:00.000Z', 'Excel DOS stays on 15th')
assert(formatCalendarDate(parsedDos!) === '6/15/2026', 'DOS displays as 6/15/2026')
assert(parseCalendarDate('6/15/2026')?.toISOString() === '2026-06-15T00:00:00.000Z', 'M/D/Y string parses')

console.log('\nAll billing session status checks passed.')
