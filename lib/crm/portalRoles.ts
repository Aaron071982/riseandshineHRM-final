import type { CrmRole } from '@prisma/client'

/** Full-department CRM roles that keep the classic multi-tab client UI. */
export const FULL_CRM_DEPT_ROLES: readonly CrmRole[] = [
  'INTAKE',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
] as const

/**
 * True when the user is an external BCBA or clinical lead without department
 * CRM roles / SUPER_ADMIN / MANAGEMENT. Used so email allowlists cannot expand
 * portal users into full CRM caseload or admin surfaces.
 */
export function isPortalClinicalOnlyRoles(
  roles: readonly CrmRole[] | null | undefined
): boolean {
  const list = roles ?? []
  const portal = list.includes('BCBA') || list.includes('CLINICAL_LEAD')
  if (!portal) return false
  if (list.includes('SUPER_ADMIN') || list.includes('MANAGEMENT')) return false
  return !list.some((r) =>
    (FULL_CRM_DEPT_ROLES as readonly string[]).includes(r)
  )
}
