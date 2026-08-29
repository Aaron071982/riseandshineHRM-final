import type { CrmRole } from '@prisma/client'
import {
  CrmAccessError,
  getUserCrmRoles,
  isFullAccess,
  isSuperAdmin,
  type CrmAccessSubject,
} from '@/lib/crm/access'

/** Roles that may view treatment assessment PHI. RBTs excluded. */
const VIEW_ROLES: readonly CrmRole[] = [
  'CLINICAL',
  'CLINICAL_SUPPORT',
  'BILLING',
  'AUTHORIZATION',
  'CASE_COORDINATION',
  'MANAGEMENT',
  'SUPER_ADMIN',
] as const

export function isClinicalSupportUser(user: CrmAccessSubject): boolean {
  return getUserCrmRoles(user).includes('CLINICAL_SUPPORT')
}

export function canViewTreatmentAssessment(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  const roles = getUserCrmRoles(user)
  if (roles.length === 0) return false
  return VIEW_ROLES.some((r) => roles.includes(r))
}

export function assertCanViewTreatmentAssessment(user: CrmAccessSubject): void {
  if (!canViewTreatmentAssessment(user)) {
    throw new CrmAccessError('Treatment assessment access required', 403)
  }
}

/** Create / edit form sections — BCBA / clinical owner (not clinical support). */
export function canEditTreatmentAssessment(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  if (isClinicalSupportUser(user)) return false
  return getUserCrmRoles(user).includes('CLINICAL')
}

export function assertCanEditTreatmentAssessment(user: CrmAccessSubject): void {
  if (!canEditTreatmentAssessment(user)) {
    throw new CrmAccessError('Clinical owner access required to edit assessments', 403)
  }
}

/** Upload attachments / completed PDF — clinical or clinical support. */
export function canUploadTreatmentAssessmentFiles(user: CrmAccessSubject): boolean {
  if (isFullAccess(user)) return true
  const roles = getUserCrmRoles(user)
  return roles.includes('CLINICAL') || roles.includes('CLINICAL_SUPPORT')
}

export function assertCanUploadTreatmentAssessmentFiles(
  user: CrmAccessSubject
): void {
  if (!canUploadTreatmentAssessmentFiles(user)) {
    throw new CrmAccessError('Clinical upload access required', 403)
  }
}

/** Mark complete / sign — clinical owner only. */
export function canCompleteTreatmentAssessment(user: CrmAccessSubject): boolean {
  return canEditTreatmentAssessment(user)
}

export function assertCanCompleteTreatmentAssessment(user: CrmAccessSubject): void {
  if (!canCompleteTreatmentAssessment(user)) {
    throw new CrmAccessError(
      'Clinical owner access required to complete or sign assessments',
      403
    )
  }
}

/** Soft-delete — clinical owner or admin. */
export function canDeleteTreatmentAssessment(user: CrmAccessSubject): boolean {
  return canEditTreatmentAssessment(user)
}

export function assertCanDeleteTreatmentAssessment(user: CrmAccessSubject): void {
  if (!canDeleteTreatmentAssessment(user)) {
    throw new CrmAccessError('Privileged access required to delete assessments', 403)
  }
}
