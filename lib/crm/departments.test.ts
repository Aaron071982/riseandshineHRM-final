import { describe, expect, it } from 'vitest'
import { getDepartmentQueueMembershipWhere } from './departments'
import { STAGE_DEFAULT_OWNER_DEPT } from './stages'

describe('department queue membership (claim-scoped)', () => {
  it('is current owner dept only — no Phase-8 cross-listing', () => {
    expect(getDepartmentQueueMembershipWhere('BILLING')).toEqual({
      currentOwnerDept: 'BILLING',
      pipelineStatus: 'LIVE',
    })
    expect(getDepartmentQueueMembershipWhere('STAFFING')).toEqual({
      currentOwnerDept: 'STAFFING',
      pipelineStatus: 'LIVE',
    })
    expect(getDepartmentQueueMembershipWhere('CASE_COORDINATION')).toEqual({
      currentOwnerDept: 'CASE_COORDINATION',
      pipelineStatus: 'LIVE',
    })
  })

  it('ACTIVE default owner is Case Coordination', () => {
    expect(STAGE_DEFAULT_OWNER_DEPT.ACTIVE).toBe('CASE_COORDINATION')
  })
})
