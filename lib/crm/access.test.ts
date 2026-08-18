import { describe, expect, it } from 'vitest'
import { PLATFORM_OWNER_EMAIL } from '@/lib/constants'
import {
  canActAsOwningDepartment,
  canAccessDepartment,
  canEditClientRecord,
  canViewClientRecord,
  getUserDepartments,
  getVisibleClientsWhere,
  isFullAccess,
  isSuperAdmin,
} from './access'
import type { CrmRole } from '@prisma/client'

const allowlisted = {
  id: 'user-full',
  email: PLATFORM_OWNER_EMAIL,
  crmRoles: [] as CrmRole[],
}

const management = {
  id: 'user-mgmt',
  email: 'mgmt-not-allowlisted@other.test',
  crmRoles: ['MANAGEMENT'] as CrmRole[],
}

const intakeOnly = {
  id: 'user-intake',
  email: 'intake@other.test',
  crmRoles: ['INTAKE'] as CrmRole[],
}

const coordinator = {
  id: 'user-coord',
  email: 'coord@other.test',
  crmRoles: ['CASE_COORDINATION'] as CrmRole[],
}

const staffing = {
  id: 'user-staffing',
  email: 'staffing@other.test',
  crmRoles: ['STAFFING'] as CrmRole[],
}

const noAccess = {
  id: 'user-none',
  email: 'nobody@other.test',
  crmRoles: [] as CrmRole[],
}

const crmSuper = {
  id: 'user-crm-sa',
  email: 'crm-sa@other.test',
  crmRoles: ['SUPER_ADMIN'] as CrmRole[],
}

describe('lib/crm/access Phase 7 RBAC', () => {
  it('break-glass: allowlisted email is full-access even with empty roles', () => {
    expect(isFullAccess(allowlisted)).toBe(true)
    expect(getVisibleClientsWhere(allowlisted)).toEqual({})
  })

  it('MANAGEMENT role is full-access without allowlist', () => {
    expect(isFullAccess(management)).toBe(true)
    expect(getVisibleClientsWhere(management)).toEqual({})
  })

  it('SUPER_ADMIN CRM role is super-admin and full-access', () => {
    expect(isSuperAdmin(crmSuper)).toBe(true)
    expect(isFullAccess(crmSuper)).toBe(true)
  })

  it('department member sees only their owner dept', () => {
    expect(getVisibleClientsWhere(intakeOnly)).toEqual({
      currentOwnerDept: { in: ['INTAKE'] },
    })
    expect(getUserDepartments(intakeOnly)).toEqual(['INTAKE'])
    expect(
      canViewClientRecord(intakeOnly, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'INTAKE',
      })
    ).toBe(true)
    expect(
      canViewClientRecord(intakeOnly, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'STAFFING',
      })
    ).toBe(false)
  })

  it('CASE_COORDINATION sees owner dept OR own caseload', () => {
    const where = getVisibleClientsWhere(coordinator)
    expect(where).toEqual({
      OR: [
        { currentOwnerDept: { in: ['CASE_COORDINATION'] } },
        { stage: 'RBT_SEARCH', pipelineStatus: 'LIVE' },
        { caseCoordinatorUserId: 'user-coord' },
      ],
    })
    expect(
      canEditClientRecord(coordinator, {
        caseCoordinatorUserId: 'user-coord',
        currentOwnerDept: 'STAFFING',
      })
    ).toBe(true)
    expect(
      canViewClientRecord(coordinator, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'STAFFING',
        stage: 'RBT_SEARCH',
        pipelineStatus: 'LIVE',
      })
    ).toBe(true)
    expect(
      canViewClientRecord(coordinator, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'STAFFING',
        stage: 'RBT_SEARCH',
        pipelineStatus: 'DISCHARGED',
      })
    ).toBe(false)
  })

  it('STAFFING sees live approved cases without taking ownership', () => {
    expect(getVisibleClientsWhere(staffing)).toEqual({
      OR: [
        { currentOwnerDept: { in: ['STAFFING'] } },
        { stage: 'APPROVED', pipelineStatus: 'LIVE' },
      ],
    })
    expect(
      canViewClientRecord(staffing, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'AUTHORIZATION',
        stage: 'APPROVED',
        pipelineStatus: 'LIVE',
      })
    ).toBe(true)
    expect(
      canViewClientRecord(staffing, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'AUTHORIZATION',
        stage: 'AUTHORIZATION',
        pipelineStatus: 'LIVE',
      })
    ).toBe(false)
  })

  it('no role + not allowlisted → deny-all where', () => {
    expect(isFullAccess(noAccess)).toBe(false)
    expect(getVisibleClientsWhere(noAccess)).toEqual({ id: { in: [] } })
    expect(
      canViewClientRecord(noAccess, {
        caseCoordinatorUserId: 'user-none',
        currentOwnerDept: 'INTAKE',
      })
    ).toBe(false)
  })

  it('email super-admin allowlist is break-glass for isSuperAdmin', () => {
    expect(isSuperAdmin({ id: 'x', email: PLATFORM_OWNER_EMAIL, crmRoles: [] })).toBe(
      true
    )
    expect(
      isSuperAdmin({ id: 'y', email: 'random@other.test', crmRoles: [] })
    ).toBe(false)
  })

  it('canAccessDepartment: intake-only blocked from clinical; full-access allowed', () => {
    expect(canAccessDepartment(intakeOnly, 'INTAKE')).toBe(true)
    expect(canAccessDepartment(intakeOnly, 'CLINICAL')).toBe(false)
    expect(canAccessDepartment(allowlisted, 'CLINICAL')).toBe(true)
    expect(canAccessDepartment(management, 'BILLING')).toBe(true)
  })

  it('canActAsOwningDepartment requires matching dept role', () => {
    expect(canActAsOwningDepartment(intakeOnly, 'INTAKE')).toBe(true)
    expect(canActAsOwningDepartment(intakeOnly, 'STAFFING')).toBe(false)
    expect(canActAsOwningDepartment(allowlisted, 'STAFFING')).toBe(true)
  })
})
