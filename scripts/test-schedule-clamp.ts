/**
 * Unit tests for appointed-hours payable policy.
 * Usage: npx tsx scripts/test-schedule-clamp.ts
 */
import {
  REVIEW_FLAG,
  calendarDayKey,
  computeAppointedPayable,
  computeOverlapClampPayable,
  formatArtemisClockTime,
  parseArtemisDateTime,
} from '../lib/billing/scheduleClamp'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('FAIL:', message)
    process.exit(1)
  }
  console.log('ok:', message)
}

function almostEqual(a: number, b: number, eps = 0.001) {
  return Math.abs(a - b) < eps
}

// Parse formats
const withComma = parseArtemisDateTime('7/29/2026, 4:00 PM')
assert(
  !!withComma && withComma.getUTCHours() === 16 && withComma.getUTCMinutes() === 0,
  'parse with comma (UTC wall-clock)'
)
const noComma = parseArtemisDateTime('7/29/2026 4:00 PM')
assert(!!noComma && noComma.getUTCHours() === 16, 'parse without comma (UTC wall-clock)')
assert(calendarDayKey(withComma!) === '2026-07-29', 'calendar day key')
assert(
  withComma!.toISOString() === '2026-07-29T16:00:00.000Z',
  'parse stores wall-clock as UTC'
)
assert(formatArtemisClockTime(withComma) === '4:00 PM', 'format ignores local TZ offset')

// Late start → still pay full appointment
{
  const r = computeAppointedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 3:20 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    rawActualMinutes: 220,
  })
  assert(almostEqual(r.payableMinutes, 240), 'late start still pays appointed 240')
  assert(r.clampApplied && !r.reviewFlag, 'late start appointed ok')
  assert(almostEqual(r.varianceMinutes, -20), 'variance shows 20 min under')
}

// Early start → still pay appointment only (not early minutes)
{
  const r = computeAppointedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 2:55 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    rawActualMinutes: 245,
  })
  assert(almostEqual(r.payableMinutes, 240), 'early start pays appointed 240')
}

// Overtime → still pay appointment only
{
  const r = computeAppointedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 7:20 PM')!,
    rawActualMinutes: 260,
  })
  assert(almostEqual(r.payableMinutes, 240), 'overtime pays appointed 240')
  assert(almostEqual(r.varianceMinutes, 20), 'variance shows 20 min over')
}

// Left early → still pay full appointment
{
  const r = computeAppointedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 6:50 PM')!,
    rawActualMinutes: 230,
  })
  assert(almostEqual(r.payableMinutes, 240), 'left early still pays appointed 240')
}

// Intisar: 4:00-8:00 sched → 4.0h appointed (actual 4:18-8:18 is stay log only)
{
  const r = computeAppointedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 4:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 8:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 4:18 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 8:18 PM')!,
    rawActualMinutes: 240,
  })
  assert(almostEqual(r.payableMinutes / 60, 4.0), 'Intisar appointed → 4.0h')
}

// Carly: 2:00-5:00 → 3.0h
{
  const r = computeAppointedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 2:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 5:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 1:57 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 5:00 PM')!,
    rawActualMinutes: 183,
  })
  assert(almostEqual(r.payableMinutes / 60, 3.0), 'Carly appointed → 3.0h')
}

// Date mismatch → flag, still pay appointed window
{
  const r = computeAppointedPayable({
    scheduledStart: parseArtemisDateTime('6/25/2026, 4:00 PM')!,
    scheduledEnd: parseArtemisDateTime('6/25/2026, 8:00 PM')!,
    actualStart: parseArtemisDateTime('7/25/2026, 4:00 PM')!,
    actualEnd: parseArtemisDateTime('7/25/2026, 8:00 PM')!,
    rawActualMinutes: 240,
  })
  assert(almostEqual(r.payableMinutes, 240), 'date mismatch still pays appointed')
  assert(r.reviewFlag === REVIEW_FLAG.DATE_MISMATCH, 'date mismatch flag')
}

// Missing appointment times → raw fallback
{
  const r = computeAppointedPayable({
    scheduledStart: null,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 5:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 2:00 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 5:00 PM')!,
    rawActualMinutes: 180,
  })
  assert(r.payableMinutes === 180 && !r.clampApplied, 'missing appointment uses raw')
  assert(r.reviewFlag === REVIEW_FLAG.MISSING_TIMES, 'missing times flag')
}

// Legacy overlap clamp still available for revert
{
  const r = computeOverlapClampPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 4:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 8:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 4:18 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 8:18 PM')!,
    rawActualMinutes: 240,
  })
  assert(almostEqual(r.payableMinutes / 60, 3.7), 'legacy overlap clamp still 3.7h')
}

console.log('\nAll appointed-hours payable checks passed.')
