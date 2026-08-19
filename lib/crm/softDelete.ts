/**
 * Central family-record fail-safe: rows with deletedAt set are hidden from
 * default queries. Hard DELETE is not used on these tables from app code.
 */
export const FAMILY_SOFT_DELETE_TABLES = [
  'service_clients',
  'client_requirements',
  'client_authorizations',
  'client_authorization_lines',
  'client_tasks',
  'client_communications',
  'client_alerts',
  'service_client_notes',
  'service_client_bt_assignments',
  'rbt_schedule_assignments',
  'client_consents',
  'client_referral_checks',
] as const

export type FamilySoftDeleteTable = (typeof FAMILY_SOFT_DELETE_TABLES)[number]

/** Prisma where fragment: only live (not soft-deleted) rows. */
export const NOT_DELETED = { deletedAt: null } as const

export function notDeleted<T extends object>(where: T): T & { deletedAt: null } {
  return { ...where, deletedAt: null }
}

export function softDeleteData(actorUserId: string | null) {
  return {
    deletedAt: new Date(),
    deletedByUserId: actorUserId,
  }
}

export function restoreData() {
  return {
    deletedAt: null,
    deletedByUserId: null,
  }
}
