import { describe, expect, it } from 'vitest'
import { defaultTargetMasteryDate } from './targetMasteryDate'

describe('defaultTargetMasteryDate', () => {
  it('returns MM/YYYY six months after the current month', () => {
    expect(defaultTargetMasteryDate(new Date(2026, 8, 4))).toBe('03/2027') // Sep → Mar
    expect(defaultTargetMasteryDate(new Date(2026, 0, 15))).toBe('07/2026') // Jan → Jul
    expect(defaultTargetMasteryDate(new Date(2026, 11, 1))).toBe('06/2027') // Dec → Jun
  })
})
