import type { CrmRole } from '@prisma/client'
import {
  CrmAccessError,
  getUserCrmRoles,
  isFullAccess,
  isSuperAdmin,
  type CrmAccessSubject,
} from '@/lib/crm/access'

const VIEW_ROLES: readonly CrmRole[] = [
  'CASE_COORDINATION',
  'CLINICAL',
  'CLINICAL_SUPPORT',
  'MANAGEMENT',
  'SUPER_ADMIN',
] as const

const EDIT_ROLES: readonly CrmRole[] = [
  'CASE_COORDINATION',
  'CLINICAL',
  'MANAGEMENT',
  'SUPER_ADMIN',
] as const

export function canViewCaseCoordination(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  const roles = getUserCrmRoles(user)
  return VIEW_ROLES.some((r) => roles.includes(r))
}

export function assertCanViewCaseCoordination(user: CrmAccessSubject): void {
  if (!canViewCaseCoordination(user)) {
    throw new CrmAccessError('Case coordination access required', 403)
  }
}

export function canEditCaseCoordination(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  const roles = getUserCrmRoles(user)
  return EDIT_ROLES.some((r) => roles.includes(r))
}

export function assertCanEditCaseCoordination(user: CrmAccessSubject): void {
  if (!canEditCaseCoordination(user)) {
    throw new CrmAccessError('Case coordination edit access required', 403)
  }
}

export function canConfirmCaseCoordination(user: CrmAccessSubject): boolean {
  return canEditCaseCoordination(user)
}

export function assertCanConfirmCaseCoordination(user: CrmAccessSubject): void {
  if (!canConfirmCaseCoordination(user)) {
    throw new CrmAccessError('Case coordination confirmation access required', 403)
  }
}
