import { describe, expect, it } from 'vitest'
import {
  hoursUtilizationPct,
  isReceivingUnderAuthorizedThreshold,
  STAFFING_HOURS_UTILIZATION_THRESHOLD,
} from './staffingUnderHours'

describe('staffingUnderHours', () => {
  it('uses 70% threshold', () => {
    expect(STAFFING_HOURS_UTILIZATION_THRESHOLD).toBe(0.7)
  })

  it('flags under 70% utilization', () => {
    expect(isReceivingUnderAuthorizedThreshold(6, 10)).toBe(true)
    expect(isReceivingUnderAuthorizedThreshold(7, 10)).toBe(false)
    expect(isReceivingUnderAuthorizedThreshold(0, 10)).toBe(true)
  })

  it('ignores missing or zero authorized hours', () => {
    expect(isReceivingUnderAuthorizedThreshold(5, null)).toBe(false)
    expect(isReceivingUnderAuthorizedThreshold(5, 0)).toBe(false)
  })

  it('computes utilization percent', () => {
    expect(hoursUtilizationPct(6, 10)).toBe(60)
    expect(hoursUtilizationPct(7, 10)).toBe(70)
  })
})
