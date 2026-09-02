import type { CrmRole } from '@prisma/client'
import {
  CrmAccessError,
  getUserCrmRoles,
  isFullAccess,
  isSuperAdmin,
  type CrmAccessSubject,
} from '@/lib/crm/access'

const FLAG_ROLES: readonly CrmRole[] = [
  'STAFFING',
  'CASE_COORDINATION',
  'MANAGEMENT',
  'SUPER_ADMIN',
] as const

export function canFlagStaffingDeparture(user: CrmAccessSubject): boolean {
  if (isFullAccess(user) || isSuperAdmin(user)) return true
  return FLAG_ROLES.some((r) => getUserCrmRoles(user).includes(r))
}

export function assertCanFlagStaffingDeparture(user: CrmAccessSubject): void {
  if (!canFlagStaffingDeparture(user)) {
    throw new CrmAccessError('Staffing flag access required', 403)
  }
}
