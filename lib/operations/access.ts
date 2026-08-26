import type { CrmAccessSubject } from '@/lib/crm/access'
import { getUserCrmRoles, isFullAccess } from '@/lib/crm/access'

/** Elevated CRM users with any department/leadership role can open Operations. */
export function canAccessOperations(user: CrmAccessSubject): boolean {
  if (isFullAccess(user)) return true
  return getUserCrmRoles(user).length > 0
}
