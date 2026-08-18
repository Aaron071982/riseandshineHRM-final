import { describe, expect, it } from 'vitest'
import { getDepartmentQueueMembershipWhere } from './departments'

describe('department queue cross-listing', () => {
  it('shows approved work in both Authorization and Staffing', () => {
    expect(getDepartmentQueueMembershipWhere('AUTHORIZATION')).toEqual({
      currentOwnerDept: 'AUTHORIZATION',
      pipelineStatus: 'LIVE',
    })
    expect(getDepartmentQueueMembershipWhere('STAFFING')).toEqual({
      pipelineStatus: 'LIVE',
      OR: [
        { currentOwnerDept: 'STAFFING' },
        { currentOwnerDept: 'AUTHORIZATION', stage: 'APPROVED' },
      ],
    })
  })

  it('shows RBT-search work in both Staffing and Case Coordination', () => {
    expect(getDepartmentQueueMembershipWhere('CASE_COORDINATION')).toEqual({
      pipelineStatus: 'LIVE',
      OR: [
        { currentOwnerDept: 'CASE_COORDINATION' },
        { currentOwnerDept: 'STAFFING', stage: 'RBT_SEARCH' },
      ],
    })
  })
})
