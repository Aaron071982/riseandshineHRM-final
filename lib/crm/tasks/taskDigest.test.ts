import { describe, expect, it } from 'vitest'
import { bucketOutstandingTasks } from '@/lib/crm/tasks/taskDigest'
import { isDigestDue } from '@/lib/crm/tasks/taskNotificationStore'
import { easternToUTC } from '@/lib/eastern-time'

describe('bucketOutstandingTasks', () => {
  it('buckets by overdue, today, week, and no due date', () => {
    const now = easternToUTC(2026, 1, 15, 12, 0)
    const buckets = bucketOutstandingTasks(
      [
        { dueAt: easternToUTC(2026, 1, 10, 12, 0) },
        { dueAt: easternToUTC(2026, 1, 15, 18, 0) },
        { dueAt: easternToUTC(2026, 1, 17, 12, 0) },
        { dueAt: null },
      ],
      now
    )
    expect(buckets.overdue).toBe(1)
    expect(buckets.dueToday).toBe(1)
    expect(buckets.dueThisWeek).toBe(1)
    expect(buckets.noDueDate).toBe(1)
  })
})

describe('isDigestDue', () => {
  it('respects per-user frequency in nights', () => {
    const last = new Date('2026-01-01T00:00:00Z')
    const now = new Date('2026-01-02T00:00:00Z')
    expect(isDigestDue(last, 2, now)).toBe(false)
    const later = new Date('2026-01-03T01:00:00Z')
    expect(isDigestDue(last, 2, later)).toBe(true)
  })
})
