/**
 * Unit tests for schedule-window payable clamp.
 * Usage: npx tsx scripts/test-schedule-clamp.ts
 */
import {
  REVIEW_FLAG,
  calendarDayKey,
  computeClampedPayable,
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
assert(!!withComma && withComma.getHours() === 16 && withComma.getMinutes() === 0, 'parse with comma')
const noComma = parseArtemisDateTime('7/29/2026 4:00 PM')
assert(!!noComma && noComma.getHours() === 16, 'parse without comma')
assert(calendarDayKey(withComma!) === '2026-07-29', 'calendar day key')

// Late start → pay from actual
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 3:20 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    rawActualMinutes: 220,
  })
  assert(almostEqual(r.payableMinutes, 220), 'late start pays from 3:20 (220 min)')
  assert(r.clampApplied && !r.reviewFlag, 'late start clamp ok')
}

// Early start → pay from scheduled
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 2:55 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    rawActualMinutes: 245,
  })
  assert(almostEqual(r.payableMinutes, 240), 'early start clamps to 240')
}

// Overtime → pay to scheduled end
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 7:20 PM')!,
    rawActualMinutes: 260,
  })
  assert(almostEqual(r.payableMinutes, 240), 'overtime clamps to 240')
}

// Left early → pay to actual end
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 7:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 6:50 PM')!,
    rawActualMinutes: 230,
  })
  assert(almostEqual(r.payableMinutes, 230), 'left early pays 230')
}

// Intisar: 4:00-8:00 sched, 4:18-8:18 actual → 3.7h
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 4:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 8:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 4:18 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 8:18 PM')!,
    rawActualMinutes: 240,
  })
  assert(almostEqual(r.payableMinutes / 60, 3.7), 'Intisar → 3.7h')
}

// Amna: 2:00-6:00 sched, 2:13-7:07 actual → 3.78h
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 2:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 6:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 2:13 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 7:07 PM')!,
    rawActualMinutes: 294,
  })
  assert(almostEqual(r.payableMinutes / 60, 3.7833, 0.01), 'Amna → ~3.78h')
}

// Carly: 2:00-5:00 sched, 1:57-5:00 actual → 3.0h
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 2:00 PM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 5:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 1:57 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 5:00 PM')!,
    rawActualMinutes: 183,
  })
  assert(almostEqual(r.payableMinutes / 60, 3.0), 'Carly → 3.0h')
}

// Date mismatch → raw fallback + flag
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('6/25/2026, 4:00 PM')!,
    scheduledEnd: parseArtemisDateTime('6/25/2026, 8:00 PM')!,
    actualStart: parseArtemisDateTime('7/25/2026, 4:00 PM')!,
    actualEnd: parseArtemisDateTime('7/25/2026, 8:00 PM')!,
    rawActualMinutes: 240,
  })
  assert(r.payableMinutes === 240, 'date mismatch uses raw')
  assert(!r.clampApplied, 'date mismatch does not clamp')
  assert(r.reviewFlag === REVIEW_FLAG.DATE_MISMATCH, 'date mismatch flag')
}

// No overlap → 0 + flag
{
  const r = computeClampedPayable({
    scheduledStart: parseArtemisDateTime('7/29/2026, 9:00 AM')!,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 10:00 AM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 2:00 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 3:00 PM')!,
    rawActualMinutes: 60,
  })
  assert(r.payableMinutes === 0, 'no overlap → 0')
  assert(r.reviewFlag === REVIEW_FLAG.NO_OVERLAP, 'no overlap flag')
}

// Missing times → raw + flag
{
  const r = computeClampedPayable({
    scheduledStart: null,
    scheduledEnd: parseArtemisDateTime('7/29/2026, 5:00 PM')!,
    actualStart: parseArtemisDateTime('7/29/2026, 2:00 PM')!,
    actualEnd: parseArtemisDateTime('7/29/2026, 5:00 PM')!,
    rawActualMinutes: 180,
  })
  assert(r.payableMinutes === 180 && !r.clampApplied, 'missing times uses raw')
  assert(r.reviewFlag === REVIEW_FLAG.MISSING_TIMES, 'missing times flag')
}

console.log('\nAll schedule-clamp checks passed.')
