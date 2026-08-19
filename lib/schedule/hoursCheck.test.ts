import { describe, expect, it } from 'vitest'
import { authorizedHoursWarning } from './hoursCheck'

describe('authorizedHoursWarning', () => {
  it('does not warn when auth hours are unset', () => {
    expect(authorizedHoursWarning({ currentHours: 8, addedHours: 6, authHours: null })).toEqual({
      projectedHours: 14,
      over: false,
    })
  })

  it('warns when projected hours exceed authorized', () => {
    const r = authorizedHoursWarning({ currentHours: 10, addedHours: 3, authHours: 12 })
    expect(r.over).toBe(true)
    expect(r.projectedHours).toBe(13)
    expect(r.warning).toMatch(/exceed authorized/)
  })

  it('does not warn when on or under target', () => {
    expect(
      authorizedHoursWarning({ currentHours: 6, addedHours: 4, authHours: 10 }).over
    ).toBe(false)
  })
})
