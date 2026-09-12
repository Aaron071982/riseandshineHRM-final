import type { CrmRole, Prisma } from '@prisma/client'
import {
  getUserCrmRoles,
  isFullAccess,
  isSuperAdmin,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import { NOT_DELETED } from '@/lib/crm/softDelete'

/** Roles that can be selected as a client's Assigned BCBA. */
export const ASSIGNABLE_BCBA_ROLES: readonly CrmRole[] = [
  'BCBA',
  'CLINICAL_LEAD',
] as const

/** Full-department CRM roles that keep the classic multi-tab client UI. */
const FULL_CRM_DEPT_ROLES: readonly CrmRole[] = [
  'INTAKE',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
] as const

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
 * Overview + Assessment only — external BCBA and clinical lead without
 * other department CRM roles.
 */
export function isClinicalSurfaceOnly(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return false
  const roles = getUserCrmRoles(user)
  const portal =
    roles.includes('BCBA') || roles.includes('CLINICAL_LEAD')
  if (!portal) return false
  return !roles.some((r) =>
    (FULL_CRM_DEPT_ROLES as readonly string[]).includes(r)
  )
}

/** Clinical lead sees every live client (assignment filter bypass). */
export function seesAllClinicalClients(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  return isClinicalLead(user)
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
