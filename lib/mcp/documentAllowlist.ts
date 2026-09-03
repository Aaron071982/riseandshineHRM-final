import type { CrmRole } from '@prisma/client'
import { isSuperAdminEmail } from '@/lib/constants'

const DOCUMENT_READ_CRM_ROLES: ReadonlySet<CrmRole> = new Set(['SUPER_ADMIN', 'INTAKE'])

export type DocumentReadSubject = {
  id: string
  email?: string | null
  canReadClientDocuments?: boolean | null
  crmRoles?: CrmRole[] | null
}

/**
 * Gate 2: named allowlist.
 * True when the user has the explicit flag, a CRM SUPER_ADMIN/INTAKE role,
 * or is a platform super-admin email.
 */
export function userCanReadClientDocuments(user: DocumentReadSubject | null | undefined): boolean {
  if (!user?.id) return false
  if (user.canReadClientDocuments === true) return true
  if (isSuperAdminEmail(user.email)) return true
  const roles = user.crmRoles ?? []
  return roles.some((r) => DOCUMENT_READ_CRM_ROLES.has(r))
}

export const DOCUMENT_READ_UNAUTHORIZED_MESSAGE =
  'Not authorized for document contents. This tool is limited to a named allowlist (CRM super-admins and intake).'
