import { describe, expect, it } from 'vitest'
import {
  STAFF_DEPARTING_REPLACEMENT_REASON,
  assignmentClearFlagPayload,
  assignmentFlagPayload,
  isOpenReplacementFlag,
  isStaffDepartingCascadeReason,
} from './departure'

describe('staffing departure helpers', () => {
  it('detects open replacement flags', () => {
    expect(isOpenReplacementFlag({ needsReplacement: true, replacementResolvedAt: null })).toBe(
      true
    )
    expect(
      isOpenReplacementFlag({
        needsReplacement: true,
        replacementResolvedAt: new Date(),
      })
    ).toBe(false)
    expect(isOpenReplacementFlag({ needsReplacement: false, replacementResolvedAt: null })).toBe(
      false
    )
  })

  it('recognizes staff departing cascade reason', () => {
    expect(isStaffDepartingCascadeReason(STAFF_DEPARTING_REPLACEMENT_REASON)).toBe(true)
    expect(isStaffDepartingCascadeReason('Staff Departing')).toBe(true)
    expect(isStaffDepartingCascadeReason('family moved')).toBe(false)
  })

  it('builds assignment flag payload', () => {
    const d = new Date('2026-09-19')
    const payload = assignmentFlagPayload({
      reason: 'RBT leaving company',
      expectedEndDate: d,
      flaggedByUserId: 'user-1',
    })
    expect(payload.needsReplacement).toBe(true)
    expect(payload.replacementReason).toBe('RBT leaving company')
    expect(payload.expectedEndDate).toBe(d)
    expect(payload.replacementFlaggedByUserId).toBe('user-1')
    expect(payload.replacementResolvedAt).toBeNull()
  })

  it('clears assignment flags', () => {
    const payload = assignmentClearFlagPayload()
    expect(payload.needsReplacement).toBe(false)
    expect(payload.replacementReason).toBeNull()
    expect(payload.replacementResolvedAt).toBeNull()
  })
})
