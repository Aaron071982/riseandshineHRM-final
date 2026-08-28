import type { CrmRole } from '@prisma/client'
import {
  CrmAccessError,
  getUserCrmRoles,
  isFullAccess,
  isSuperAdmin,
  type CrmAccessSubject,
} from '@/lib/crm/access'

/** Roles that may view locked clinical assessment PHI. RBTs excluded. */
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

export function canViewClinicalAssessment(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  const roles = getUserCrmRoles(user)
  if (roles.length === 0) return false
  return VIEW_ROLES.some((r) => roles.includes(r))
}

export function assertCanViewClinicalAssessment(user: CrmAccessSubject): void {
  if (!canViewClinicalAssessment(user)) {
    throw new CrmAccessError('Clinical assessment access required', 403)
  }
}

/** Upload / route artifacts — clinical owner or clinical support. */
export function canUploadClinicalAssessmentArtifacts(
  user: CrmAccessSubject
): boolean {
  if (isFullAccess(user)) return true
  const roles = getUserCrmRoles(user)
  return roles.includes('CLINICAL') || roles.includes('CLINICAL_SUPPORT')
}

export function assertCanUploadClinicalAssessmentArtifacts(
  user: CrmAccessSubject
): void {
  if (!canUploadClinicalAssessmentArtifacts(user)) {
    throw new CrmAccessError('Clinical upload access required', 403)
  }
}

/** Lock assessment — BCBA / clinical owner only (not clinical support). */
export function canLockClinicalAssessment(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  if (isClinicalSupportUser(user)) return false
  return getUserCrmRoles(user).includes('CLINICAL')
}

export function assertCanLockClinicalAssessment(user: CrmAccessSubject): void {
  if (!canLockClinicalAssessment(user)) {
    throw new CrmAccessError('Clinical owner access required to lock assessments', 403)
  }
}

/** Unlock — clinical owner or admin only. */
export function canUnlockClinicalAssessment(user: CrmAccessSubject): boolean {
  return canLockClinicalAssessment(user)
}

export function assertCanUnlockClinicalAssessment(
  user: CrmAccessSubject
): void {
  if (!canUnlockClinicalAssessment(user)) {
    throw new CrmAccessError('Privileged access required to unlock assessments', 403)
  }
}

/** Treatment plan checkbox — clinical or admin. */
export function canMarkTreatmentPlanComplete(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  if (isClinicalSupportUser(user)) return false
  const roles = getUserCrmRoles(user)
  return roles.includes('CLINICAL') || roles.includes('MANAGEMENT')
}

export function assertCanMarkTreatmentPlanComplete(
  user: CrmAccessSubject
): void {
  if (!canMarkTreatmentPlanComplete(user)) {
    throw new CrmAccessError(
      'Clinical or admin access required to mark treatment plan complete',
      403
    )
  }
}
