import { describe, expect, it } from 'vitest'
import {
  CLAIMABLE_POOL_FIELDS,
  CLAIMABLE_POOL_FORBIDDEN_FIELDS,
  CLAIMABLE_POOL_SELECT,
  claimablePoolPayloadKeys,
  isReadyForCoordination,
  ownershipPatchOnDeptChange,
  toClaimablePoolRow,
} from './claims'

describe('claimable pool PHI restriction', () => {
  it('selects only id, firstName, lastName, stage', () => {
    expect(Object.keys(CLAIMABLE_POOL_SELECT).sort()).toEqual(
      [...CLAIMABLE_POOL_FIELDS].sort()
    )
    for (const field of CLAIMABLE_POOL_FORBIDDEN_FIELDS) {
      expect(field in CLAIMABLE_POOL_SELECT).toBe(false)
    }
  })

  it('toClaimablePoolRow drops extra PHI if a caller passes it', () => {
    const row = toClaimablePoolRow({
      id: 'c1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      stage: 'INTAKE',
    })
    expect(claimablePoolPayloadKeys(row as unknown as Record<string, unknown>)).toEqual(
      [...CLAIMABLE_POOL_FIELDS].sort()
    )
    expect(row).not.toHaveProperty('dateOfBirth')
    expect(row).not.toHaveProperty('insuranceProvider')
    expect(row).not.toHaveProperty('parentName')
  })
})

describe('CC Upcoming vs Ready', () => {
  it('splits on RBT_ASSIGNED', () => {
    expect(isReadyForCoordination('RBT_SEARCH')).toBe(false)
    expect(isReadyForCoordination('APPROVED')).toBe(false)
    expect(isReadyForCoordination('RBT_ASSIGNED')).toBe(true)
    expect(isReadyForCoordination('ACTIVE')).toBe(true)
    expect(isReadyForCoordination('SCHEDULE_COORDINATION')).toBe(true)
  })
})

describe('ownershipPatchOnDeptChange', () => {
  it('releases CLAIM grants when department changes and does not when it stays', () => {
    const same = ownershipPatchOnDeptChange({
      fromDept: 'INTAKE',
      toDept: 'INTAKE',
      caseCoordinatorUserId: null,
    })
    expect(same.deptChanged).toBe(false)
    expect(same.shouldReleaseClaimGrants).toBe(false)

    const hop = ownershipPatchOnDeptChange({
      fromDept: 'INTAKE',
      toDept: 'CLINICAL',
      caseCoordinatorUserId: null,
    })
    expect(hop.deptChanged).toBe(true)
    expect(hop.shouldReleaseClaimGrants).toBe(true)
    expect(hop.currentOwnerUserId).toBeNull()
  })

  it('Active → Billing bounce-back keeps stage caller-controlled and clears personal claim', () => {
    const bounce = ownershipPatchOnDeptChange({
      fromDept: 'CASE_COORDINATION',
      toDept: 'BILLING',
      caseCoordinatorUserId: 'cc-1',
    })
    expect(bounce.shouldReleaseClaimGrants).toBe(true)
    expect(bounce.currentOwnerDept).toBe('BILLING')
    expect(bounce.currentOwnerUserId).toBeNull()
  })

  it('hand-off into Case Coordination restores the assigned CC as owner user', () => {
    const intoCc = ownershipPatchOnDeptChange({
      fromDept: 'BILLING',
      toDept: 'CASE_COORDINATION',
      caseCoordinatorUserId: 'cc-1',
    })
    expect(intoCc.currentOwnerUserId).toBe('cc-1')
  })
})
