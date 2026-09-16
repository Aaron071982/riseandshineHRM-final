import type { CrmRole, Prisma } from '@prisma/client'
import {
  CrmAccessError,
  getUserCrmRoles,
  isFullAccess,
  isSuperAdmin,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import {
  FULL_CRM_DEPT_ROLES,
  isPortalClinicalOnlyRoles,
} from '@/lib/crm/portalRoles'
import { NOT_DELETED } from '@/lib/crm/softDelete'

/** Roles that can be selected as a client's Assigned BCBA. */
export const ASSIGNABLE_BCBA_ROLES: readonly CrmRole[] = [
  'BCBA',
  'CLINICAL_LEAD',
] as const

export { FULL_CRM_DEPT_ROLES, isPortalClinicalOnlyRoles }

export function hasCrmRole(
  user: CrmAccessSubject,
  role: CrmRole
): boolean {
  return getUserCrmRoles(user).includes(role)
}

export function isClinicalLead(user: CrmAccessSubject): boolean {
  return hasCrmRole(user, 'CLINICAL_LEAD')
}

export function isExternalBcba(user: CrmAccessSubject): boolean {
  return hasCrmRole(user, 'BCBA')
}

/**
 * Clinical portal roles that enter Client Services for assessment work
 * without needing the HRM ADMIN flag.
 */
export function hasBcbaPortalAccess(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  const roles = getUserCrmRoles(user)
  return (
    roles.includes('BCBA') ||
    roles.includes('CLINICAL_LEAD') ||
    roles.includes('CLINICAL') ||
    roles.includes('CLINICAL_SUPPORT')
  )
}

/**
 * Overview + Authorization + Assessment + Schedule (view-only) —
 * external BCBA and clinical lead without other department CRM roles.
 * Email allowlist alone does not expand these users into full CRM.
 */
export function isClinicalSurfaceOnly(user: CrmAccessSubject): boolean {
  if (isSuperAdmin(user)) return false
  return isPortalClinicalOnlyRoles(getUserCrmRoles(user))
}

/** Clinical lead sees every live client (assignment filter bypass). */
export function seesAllClinicalClients(user: CrmAccessSubject): boolean {
  if (isSuperAdmin(user)) return true
  if (isClinicalLead(user)) return true
  if (isFullAccess(user) && !isPortalClinicalOnlyRoles(getUserCrmRoles(user))) {
    return true
  }
  return false
}

/**
 * Prisma filter for BCBA / clinical-lead caseload.
 * CLINICAL_LEAD → all non-deleted; BCBA → assignedBcbaId = self;
 * otherwise null (caller should use claim-based visibility).
 */
export function getBcbaPortalClientsWhere(
  user: CrmAccessSubject
): Prisma.ServiceClientWhereInput | null {
  if (!user.id) return { id: { in: [] } }
  if (seesAllClinicalClients(user)) return { ...NOT_DELETED }
  if (isExternalBcba(user)) {
    return {
      AND: [{ ...NOT_DELETED }, { assignedBcbaId: user.id }],
    }
  }
  return null
}

export function canViewClientAsAssignedBcba(
  user: CrmAccessSubject,
  assignedBcbaId: string | null | undefined
): boolean {
  if (seesAllClinicalClients(user)) return true
  if (!isExternalBcba(user) || !user.id) return false
  return assignedBcbaId === user.id
}

/**
 * Portal clinical roles may view the schedule matrix but must not mutate it.
 * Call at the top of every schedule write path (UI canEdit=false is not enough).
 */
export function assertPortalScheduleReadOnly(user: CrmAccessSubject): void {
  if (!isClinicalSurfaceOnly(user)) return
  throw new CrmAccessError(
    'Schedule is view-only in the BCBA portal. Contact staffing to request changes.',
    403
  )
}

export function canMutateClientSchedule(user: CrmAccessSubject): boolean {
  return !isClinicalSurfaceOnly(user)
}
