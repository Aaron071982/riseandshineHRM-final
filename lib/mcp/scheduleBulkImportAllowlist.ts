import type { CrmRole } from '@prisma/client'
import { isSuperAdminEmail } from '@/lib/constants'

/**
 * Permission: schedule:bulk_import (scope all).
 * Default off. Explicit User.canBulkImportSchedule flag only — not implied by CRM roles.
 * Platform super-admin emails may grant/revoke in the admin UI but still need the flag
 * to call the MCP tools (keeps the one-time grant model honest).
 */
export type BulkImportSubject = {
  id: string
  email?: string | null
  canBulkImportSchedule?: boolean | null
  crmRoles?: CrmRole[] | null
}

export function userCanBulkImportSchedule(
  user: BulkImportSubject | null | undefined
): boolean {
  if (!user?.id) return false
  return user.canBulkImportSchedule === true
}

/** Admins who may grant/revoke the flag or approve a batch. */
export function userCanManageBulkImportGrants(
  user: BulkImportSubject | null | undefined
): boolean {
  if (!user?.id) return false
  if (isSuperAdminEmail(user.email)) return true
  const roles = user.crmRoles ?? []
  return roles.includes('SUPER_ADMIN')
}

export const BULK_IMPORT_UNAUTHORIZED_MESSAGE =
  'Forbidden: schedule:bulk_import grant required. Ask an admin to grant the one-time flag, then revoke it after the import.'

export const BULK_IMPORT_IDENTITY_REQUIRED_MESSAGE =
  'Unauthorized: MCP write requires a resolved OAuth user identity (not the static API key).'

/** Max rows per commit (paginate larger loads across commits). */
export const BULK_IMPORT_BATCH_CAP = 200

/** Preview tokens expire after this many hours. */
export const BULK_IMPORT_PREVIEW_TTL_HOURS = 4

/**
 * When true, first commit parks the batch as AWAITING_ADMIN until an admin
 * clears requiresAdminApproval in the app. Toggle via env for self-serve.
 */
export function bulkImportRequiresAdminApproval(): boolean {
  const raw = process.env.SCHEDULE_BULK_IMPORT_REQUIRES_ADMIN_APPROVAL
  if (raw == null || raw === '') return true
  return !['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase())
}
