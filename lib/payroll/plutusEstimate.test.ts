import { describe, expect, it } from 'vitest'
import {
  estimatePlutusBilled,
  estimatePlutusFromHours,
} from '@/lib/payroll/plutusEstimate'

describe('plutusEstimate', () => {
  it('bills 97153 medicaid units from minutes', () => {
    // 60 min = 4 units × $14.45
    expect(estimatePlutusBilled([{ procedureCode: '97153', actualMinutes: 60 }])).toBe(57.8)
  })

  it('falls back to hours × CPT rates', () => {
    const v = estimatePlutusFromHours({ rbtHours: 10, bcbaHours: 2 })
    expect(v).toBeGreaterThan(0)
  })
})
