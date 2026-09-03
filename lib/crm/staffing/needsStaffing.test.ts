import { describe, expect, it } from 'vitest'
import {
  classifyClientStaffingNeed,
  clientNeedsStaffing,
  type ClientStaffingSnapshot,
} from '@/lib/crm/staffing/needsStaffing'
import {
  clientMarkerFromStage,
  clientStaffingNote,
  therapistMarkerColor,
  therapistStatusLabel,
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
  it('maps actively-working postHireStage to green, others to red', () => {
    expect(therapistMarkerColor('ACTIVE_DELIVERY')).toBe('green')
    expect(therapistMarkerColor('MATCHING')).toBe('red')
    expect(therapistMarkerColor(null)).toBe('red')
    expect(therapistStatusLabel('ACTIVE_DELIVERY', 'HIRED')).toBe('Actively working')
    expect(therapistStatusLabel('MATCHING', 'HIRED')).toBe('Not actively working')
    expect(therapistStatusLabel(null, 'REACH_OUT')).toBe('Reach-out pipeline')
  })

  it('maps client CRM stage to stage-group colors', () => {
    expect(clientMarkerFromStage('ACTIVE').markerColor).toBe('ACTIVE')
    expect(clientMarkerFromStage('RBT_SEARCH').markerColor).toBe('STAFFING')
    expect(clientStaffingNote(true, ['losing_staff_soon'])).toMatch(/Losing staff/)
    expect(clientStaffingNote(false, [])).toBeNull()
  })
})
