import { describe, expect, it } from 'vitest'
import { businessDaysBetween, calendarDaysBetween } from './businessDays'

describe('businessDaysBetween', () => {
  it('counts weekdays after the start date', () => {
    // Mon Oct 5 2026 → Thu Oct 8 2026
    expect(businessDaysBetween(new Date('2026-10-05T12:00:00Z'), new Date('2026-10-08T12:00:00Z'))).toBe(3)
  })

  it('skips weekends', () => {
    // Fri Oct 9 2026 → Tue Oct 13 2026 (Mon, Tue)
    expect(businessDaysBetween(new Date('2026-10-09T12:00:00Z'), new Date('2026-10-13T12:00:00Z'))).toBe(2)
  })

  it('returns 0 for same day or reversed range', () => {
    const d = new Date('2026-10-07T12:00:00Z')
    expect(businessDaysBetween(d, d)).toBe(0)
    expect(businessDaysBetween(d, new Date('2026-10-01T12:00:00Z'))).toBe(0)
  })
})

describe('calendarDaysBetween', () => {
  it('floors whole days', () => {
    expect(calendarDaysBetween(new Date('2026-10-01T00:00:00Z'), new Date('2026-10-07T23:00:00Z'))).toBe(6)
  })
})
