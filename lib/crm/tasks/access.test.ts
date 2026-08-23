import { describe, expect, it } from 'vitest'
import type { CrmRole } from '@prisma/client'
import {
  isMyTeamTask,
  teamTaskVisibilityWhere,
  userOwnerDepts,
} from './access'
import { isMyTeamTask as isMyTeamTaskPure } from './myTasks'

const intakeUser = {
  id: 'u1',
  email: 'a@riseandshineaba.com',
  crmRoles: ['INTAKE'] as CrmRole[],
}

describe('lib/crm/tasks/access', () => {
  it('userOwnerDepts maps CRM roles to owner departments', () => {
    expect(userOwnerDepts(intakeUser)).toContain('INTAKE')
  })

  it('teamTaskVisibilityWhere includes standalone involvement OR visible clients', () => {
    const where = teamTaskVisibilityWhere(intakeUser)
    expect(where.deletedAt).toBeNull()
    expect(where.OR).toBeDefined()
    expect(Array.isArray(where.OR)).toBe(true)
  })

  it('re-exports isMyTeamTask', () => {
    expect(isMyTeamTask).toBe(isMyTeamTaskPure)
  })
})

describe('isMyTeamTask', () => {
  const owned = ['client-a', 'client-b']

  it('includes tasks assigned to the user', () => {
    expect(
      isMyTeamTaskPure(
        {
          assignedToUserId: 'u1',
          assignedDept: null,
          serviceClientId: null,
          status: 'TODO',
        },
        'u1',
        owned
      )
    ).toBe(true)
  })

  it('includes tasks for actively claimed / owned clients', () => {
    expect(
      isMyTeamTaskPure(
        {
          assignedToUserId: 'someone-else',
          assignedDept: null,
          serviceClientId: 'client-a',
          status: 'IN_PROGRESS',
        },
        'u1',
        owned
      )
    ).toBe(true)
  })

  it('excludes tasks for clients the user does not own', () => {
    expect(
      isMyTeamTaskPure(
        {
          assignedToUserId: 'someone-else',
          assignedDept: null,
          serviceClientId: 'client-z',
          status: 'TODO',
        },
        'u1',
        owned
      )
    ).toBe(false)
  })

  it('includes standalone department pool tasks', () => {
    expect(
      isMyTeamTaskPure(
        {
          assignedToUserId: null,
          assignedDept: 'INTAKE',
          serviceClientId: null,
          status: 'TODO',
        },
        'u1',
        owned
      )
    ).toBe(true)
  })

  it('excludes done tasks', () => {
    expect(
      isMyTeamTaskPure(
        {
          assignedToUserId: 'u1',
          assignedDept: null,
          serviceClientId: 'client-a',
          status: 'DONE',
        },
        'u1',
        owned
      )
    ).toBe(false)
  })
})
