import { describe, expect, it } from 'vitest'
import { PLATFORM_OWNER_EMAIL } from '@/lib/constants'
import {
  canAccessCrmSchedule,
  canActAsOwningDepartment,
  canAccessDepartment,
  canCreateServiceClient,
  canEditClientRecord,
  canViewClientRecord,
  getUserDepartments,
  getVisibleClientsWhere,
  isFullAccess,
  isSuperAdmin,
  rethrowIfNextControlFlow,
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

describe('lib/crm/access Phase 17 claim-scoped', () => {
  it('break-glass: allowlisted email is full-access even with empty roles', () => {
    expect(isFullAccess(allowlisted)).toBe(true)
    expect(getVisibleClientsWhere(allowlisted)).toEqual({ deletedAt: null })
  })

  it('MANAGEMENT role is full-access without allowlist', () => {
    expect(isFullAccess(management)).toBe(true)
    expect(getVisibleClientsWhere(management)).toEqual({ deletedAt: null })
    expect(canCreateServiceClient(management)).toBe(true)
  })

  it('INTAKE can create clients without full caseload access', () => {
    expect(isFullAccess(intakeOnly)).toBe(false)
    expect(canCreateServiceClient(intakeOnly)).toBe(true)
  })

  it('department roles without intake cannot create clients', () => {
    expect(canCreateServiceClient(coordinator)).toBe(false)
    expect(canCreateServiceClient(staffing)).toBe(false)
    expect(canCreateServiceClient(noAccess)).toBe(false)
    expect(canCreateServiceClient(allowlisted)).toBe(true)
  })

  it('SUPER_ADMIN CRM role is super-admin and full-access', () => {
    expect(isSuperAdmin(crmSuper)).toBe(true)
    expect(isFullAccess(crmSuper)).toBe(true)
  })

  it('department member Clients tab is ever-claimed grants, not owner dept', () => {
    expect(getVisibleClientsWhere(intakeOnly)).toEqual({
      AND: [
        { deletedAt: null },
        { claims: { some: { userId: 'user-intake' } } },
      ],
    })
    expect(getUserDepartments(intakeOnly)).toEqual(['INTAKE'])
  })

  it('unclaimed profile access is denied even in the member’s department', () => {
    expect(
      canViewClientRecord(intakeOnly, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'INTAKE',
        hasClaimGrant: false,
      })
    ).toBe(false)
    expect(
      canViewClientRecord(intakeOnly, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'INTAKE',
        hasClaimGrant: true,
      })
    ).toBe(true)
  })

  it('ever-claimed view persists after hand-off to another department', () => {
    expect(
      canViewClientRecord(intakeOnly, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'CLINICAL',
        hasClaimGrant: true,
      })
    ).toBe(true)
    expect(
      canEditClientRecord(intakeOnly, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'CLINICAL',
        hasClaimGrant: true,
      })
    ).toBe(false)
  })

  it('edit requires current department ownership (or assigned CC / full-visibility)', () => {
    expect(
      canEditClientRecord(intakeOnly, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'INTAKE',
        hasClaimGrant: true,
      })
    ).toBe(true)
    expect(
      canEditClientRecord(coordinator, {
        caseCoordinatorUserId: 'user-coord',
        currentOwnerDept: 'STAFFING',
        hasClaimGrant: true,
      })
    ).toBe(true)
    expect(
      canEditClientRecord(coordinator, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'STAFFING',
        hasClaimGrant: true,
      })
    ).toBe(false)
  })

  it('department role alone is not enough to view or list a client', () => {
    expect(
      canViewClientRecord(staffing, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'STAFFING',
        stage: 'RBT_SEARCH',
        pipelineStatus: 'LIVE',
        hasClaimGrant: false,
      })
    ).toBe(false)
    expect(getVisibleClientsWhere(staffing)).toEqual({
      AND: [
        { deletedAt: null },
        { claims: { some: { userId: 'user-staffing' } } },
      ],
    })
  })

  it('no role + not allowlisted → empty grant filter (no clients unless they somehow have a grant)', () => {
    expect(isFullAccess(noAccess)).toBe(false)
    expect(getVisibleClientsWhere(noAccess)).toEqual({
      AND: [
        { deletedAt: null },
        { claims: { some: { userId: 'user-none' } } },
      ],
    })
    expect(
      canViewClientRecord(noAccess, {
        caseCoordinatorUserId: 'user-none',
        currentOwnerDept: 'INTAKE',
        hasClaimGrant: false,
      })
    ).toBe(false)
  })

  it('full-visibility sees all regardless of grant', () => {
    expect(
      canViewClientRecord(allowlisted, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'INTAKE',
        hasClaimGrant: false,
      })
    ).toBe(true)
    expect(
      canEditClientRecord(allowlisted, {
        caseCoordinatorUserId: null,
        currentOwnerDept: 'BILLING',
        hasClaimGrant: false,
      })
    ).toBe(true)
  })

  it('email super-admin allowlist is break-glass for isSuperAdmin', () => {
    expect(isSuperAdmin({ id: 'x', email: PLATFORM_OWNER_EMAIL, crmRoles: [] })).toBe(
      true
    )
    expect(
      isSuperAdmin({ id: 'y', email: 'random@other.test', crmRoles: [] })
    ).toBe(false)
  })

  it('canAccessCrmSchedule: staffing, case-coordination, full-access only', () => {
    expect(canAccessCrmSchedule(staffing)).toBe(true)
    expect(canAccessCrmSchedule(coordinator)).toBe(true)
    expect(canAccessCrmSchedule(allowlisted)).toBe(true)
    expect(canAccessCrmSchedule(intakeOnly)).toBe(false)
    expect(canAccessCrmSchedule(noAccess)).toBe(false)
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

  it('rethrowIfNextControlFlow rethrows redirect/notFound and ignores other errors', () => {
    const redirectErr = { digest: 'NEXT_REDIRECT;replace;/client-services;303;' }
    expect(() => rethrowIfNextControlFlow(redirectErr)).toThrow(redirectErr)
    const notFoundErr = { digest: 'NEXT_NOT_FOUND' }
    expect(() => rethrowIfNextControlFlow(notFoundErr)).toThrow(notFoundErr)
    expect(() => rethrowIfNextControlFlow(new Error('db down'))).not.toThrow()
    expect(() => rethrowIfNextControlFlow('nope')).not.toThrow()
  })
})
