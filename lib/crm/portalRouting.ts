import type { CrmRole } from '@prisma/client'
import { getPostLoginPath } from '@/lib/auth/postLogin'
import { isPortalClinicalOnlyRoles } from '@/lib/crm/portalRoles'

/** Dedicated external BCBA / clinical-lead workspace. */
export const PORTAL_HOME_PATH = '/portal'

/**
 * Post-login path when CRM roles are known.
 * Portal-only BCBA / CLINICAL_LEAD → /portal; otherwise HRM role defaults.
 */
export function getPostLoginPathForCrmUser(input: {
  role: string | null | undefined
  email?: string | null
  crmRoles: readonly CrmRole[] | null | undefined
}): string | null {
  if (isPortalClinicalOnlyRoles(input.crmRoles)) {
    return PORTAL_HOME_PATH
  }
  return getPostLoginPath(input.role, input.email)
}
