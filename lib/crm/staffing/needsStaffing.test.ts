import { describe, expect, it } from 'vitest'
import {
  classifyClientStaffingNeed,
  clientNeedsStaffing,
  type ClientStaffingSnapshot,
} from '@/lib/crm/staffing/needsStaffing'
import {
  clientMarkerColor,
  clientStatusLabel,
  therapistMarkerColor,
} from '@/lib/crm/therapistClientMap/markerColors'

describe('classifyClientStaffingNeed', () => {
  const base: ClientStaffingSnapshot = {
    id: 'c1',
    stage: 'ACTIVE',
    staffingNeedsMoreHours: false,
    authHours: 20,
    activeBtCount: 1,
    scheduledHoursPerWeek: 15,
    hasOpenReplacementFlag: false,
  }

  it('flags staffing pipeline stages as unstaffed', () => {
    expect(
      classifyClientStaffingNeed({ ...base, stage: 'RBT_SEARCH', activeBtCount: 0 })
    ).toEqual(['unstaffed'])
  })

  it('flags active clients with no BT as unstaffed', () => {
    expect(
      classifyClientStaffingNeed({ ...base, activeBtCount: 0 })
    ).toContain('unstaffed')
  })

  it('flags manual needs-more-hours as understaffed', () => {
    expect(
      classifyClientStaffingNeed({ ...base, staffingNeedsMoreHours: true })
    ).toContain('understaffed')
  })

  it('flags under-70% utilization as understaffed', () => {
    expect(
      classifyClientStaffingNeed({
        ...base,
        authHours: 20,
        scheduledHoursPerWeek: 10,
      })
    ).toContain('understaffed')
  })

  it('flags open replacement as losing_staff_soon', () => {
    expect(
      classifyClientStaffingNeed({
        ...base,
        hasOpenReplacementFlag: true,
      })
    ).toContain('losing_staff_soon')
  })

  it('returns settled when fully staffed', () => {
    expect(clientNeedsStaffing(base)).toBe(false)
  })
})

describe('markerColors', () => {
  it('maps therapist hiring stage to green or blue', () => {
    expect(therapistMarkerColor('HIRED')).toBe('green')
    expect(therapistMarkerColor('ONBOARDING_COMPLETED')).toBe('green')
    expect(therapistMarkerColor('REACH_OUT')).toBe('blue')
  })

  it('maps client staffing need to orange or black', () => {
    expect(clientMarkerColor(true)).toBe('orange')
    expect(clientMarkerColor(false)).toBe('black')
    expect(clientStatusLabel(true, ['losing_staff_soon'])).toMatch(/Losing staff/)
    expect(clientStatusLabel(false, [])).toMatch(/settled/)
  })
})
