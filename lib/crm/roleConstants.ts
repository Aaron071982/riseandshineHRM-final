import type { ClientOwnerDept, CrmRole } from '@prisma/client'

/** Department-scoped CRM roles (not SUPER_ADMIN / MANAGEMENT). */
export const CRM_DEPARTMENT_ROLES: readonly CrmRole[] = [
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
] as const

/** Map CRM department role → service_clients.currentOwnerDept. */
export const CRM_ROLE_TO_OWNER_DEPT: Partial<
  Record<CrmRole, ClientOwnerDept>
> = {
  INTAKE: 'INTAKE',
  CLINICAL: 'CLINICAL',
  AUTHORIZATION: 'AUTHORIZATION',
  STAFFING: 'STAFFING',
  CASE_COORDINATION: 'CASE_COORDINATION',
  BILLING: 'BILLING',
}

/** Inverse: owner dept → CRM role required to work that queue. */
export const OWNER_DEPT_TO_CRM_ROLE: Record<ClientOwnerDept, CrmRole> = {
  INTAKE: 'INTAKE',
  CLINICAL: 'CLINICAL',
  AUTHORIZATION: 'AUTHORIZATION',
  STAFFING: 'STAFFING',
  CASE_COORDINATION: 'CASE_COORDINATION',
  BILLING: 'BILLING',
}
