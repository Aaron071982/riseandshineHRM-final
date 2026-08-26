import type { CrmRole, UserRole } from '@prisma/client'
import { CRM_DEPARTMENT_ROLES } from '@/lib/crm/roleConstants'

/** UserRole keys assignable as org-training audience (excludes ADMIN/CANDIDATE/DEV). */
export const ORG_TRAINING_USER_ROLES = [
  'RBT',
  'BCBA',
  'BILLING',
  'MARKETING',
  'CALL_CENTER',
  'TRAINER',
] as const satisfies readonly UserRole[]

/** CrmRole keys assignable as audience. */
export const ORG_TRAINING_CRM_ROLES = [
  ...CRM_DEPARTMENT_ROLES,
  'SUPER_ADMIN',
  'MANAGEMENT',
] as const satisfies readonly CrmRole[]

export type OrgTrainingAudienceKey =
  | (typeof ORG_TRAINING_USER_ROLES)[number]
  | (typeof ORG_TRAINING_CRM_ROLES)[number]

export const ORG_TRAINING_AUDIENCE_OPTIONS: {
  key: OrgTrainingAudienceKey
  label: string
  group: 'user' | 'crm'
}[] = [
  { key: 'RBT', label: 'RBT', group: 'user' },
  { key: 'BCBA', label: 'BCBA', group: 'user' },
  { key: 'BILLING', label: 'Billing', group: 'user' },
  { key: 'MARKETING', label: 'Marketing', group: 'user' },
  { key: 'CALL_CENTER', label: 'Call Center', group: 'user' },
  { key: 'TRAINER', label: 'Trainer', group: 'user' },
  { key: 'INTAKE', label: 'Intake', group: 'crm' },
  { key: 'CLINICAL', label: 'Clinical', group: 'crm' },
  { key: 'AUTHORIZATION', label: 'Authorization', group: 'crm' },
  { key: 'STAFFING', label: 'Staffing', group: 'crm' },
  { key: 'CASE_COORDINATION', label: 'Case Coordination', group: 'crm' },
  { key: 'SUPER_ADMIN', label: 'Super Admin', group: 'crm' },
  { key: 'MANAGEMENT', label: 'Management', group: 'crm' },
]

const VALID_AUDIENCE = new Set<string>([
  ...ORG_TRAINING_USER_ROLES,
  ...ORG_TRAINING_CRM_ROLES,
])

export function isValidAudienceKey(key: string): key is OrgTrainingAudienceKey {
  return VALID_AUDIENCE.has(key)
}

export function sanitizeAudienceRoles(roles: string[]): string[] {
  const out: string[] = []
  for (const r of roles) {
    const key = String(r).trim().toUpperCase()
    if (isValidAudienceKey(key) && !out.includes(key)) out.push(key)
  }
  return out
}

export type AudienceUser = {
  role?: string | null
  crmRoles?: readonly string[] | null
}

/** Role keys used to match module.audienceRoles. */
export function userAudienceKeys(user: AudienceUser): string[] {
  const keys = new Set<string>()
  const role = (user.role ?? '').toUpperCase()
  if (role) keys.add(role)
  for (const r of user.crmRoles ?? []) {
    const k = String(r).toUpperCase()
    if (k) keys.add(k)
  }
  return Array.from(keys)
}

export function moduleAssignedToUser(
  module: { audienceRoles: string[] },
  keys: string[]
): boolean {
  if (!module.audienceRoles.length) return false
  const keySet = new Set(keys.map((k) => k.toUpperCase()))
  return module.audienceRoles.some((r) => keySet.has(r.toUpperCase()))
}
