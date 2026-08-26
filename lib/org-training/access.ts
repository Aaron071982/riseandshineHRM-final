import { isAdmin, type SessionUser } from '@/lib/auth'
import { isFullAccess, type CrmAccessSubject } from '@/lib/crm/access'

export {
  ORG_TRAINING_AUDIENCE_OPTIONS,
  ORG_TRAINING_CRM_ROLES,
  ORG_TRAINING_USER_ROLES,
  isValidAudienceKey,
  moduleAssignedToUser,
  sanitizeAudienceRoles,
  userAudienceKeys,
  type AudienceUser,
  type OrgTrainingAudienceKey,
} from '@/lib/org-training/audience'

/** Admin portal authoring (create/edit/archive/upload). */
export function canAuthorOrgTraining(user: SessionUser | null): boolean {
  return isAdmin(user)
}

/**
 * Completion matrix: platform admin, or CRM full access / MANAGEMENT / SUPER_ADMIN.
 */
export function canViewOrgTrainingMatrix(
  user: SessionUser | null,
  crmSubject?: CrmAccessSubject | null
): boolean {
  if (isAdmin(user)) return true
  if (!crmSubject) return false
  if (isFullAccess(crmSubject)) return true
  const roles = crmSubject.crmRoles ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('MANAGEMENT')
}
