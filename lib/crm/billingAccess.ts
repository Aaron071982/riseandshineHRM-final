import type { ClientStage, CrmRole } from '@prisma/client'
import {
  CrmAccessError,
  getUserCrmRoles,
  isFullAccess,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import { stageIndex } from '@/lib/crm/stages'

const BILLING_CRM_ROLES: readonly CrmRole[] = ['BILLING', 'AUTHORIZATION'] as const

/** Billing / authorization department CRM roles (not platform RBT). */
export function isBillingCrmUser(user: CrmAccessSubject): boolean {
  if (isFullAccess(user)) return true
  const roles = getUserCrmRoles(user)
  return BILLING_CRM_ROLES.some((r) => roles.includes(r))
}

/** Billing authorization surface — RBT-only users never hold CRM billing roles. */
export function canAccessBillingSurface(user: CrmAccessSubject): boolean {
  return isBillingCrmUser(user)
}

export function assertCanAccessBillingSurface(user: CrmAccessSubject): void {
  if (!canAccessBillingSurface(user)) {
    throw new CrmAccessError('Billing authorization access required', 403)
  }
}

/** Billing document read opens from Benefits (VOB) stage onward. */
export function canViewBillingDocuments(clientStage: ClientStage): boolean {
  return stageIndex(clientStage) >= stageIndex('BENEFITS')
}

/**
 * Billing-only users may download client documents from VOB onward.
 * Full-access and non-billing CRM roles keep existing view rules.
 */
export function canDownloadClientDocuments(
  user: CrmAccessSubject,
  clientStage: ClientStage
): boolean {
  if (isFullAccess(user)) return true
  if (!isBillingCrmUser(user)) return true
  return canViewBillingDocuments(clientStage)
}

export function assertCanDownloadClientDocuments(
  user: CrmAccessSubject,
  clientStage: ClientStage
): void {
  if (!canDownloadClientDocuments(user, clientStage)) {
    throw new CrmAccessError(
      'Client documents are available from Benefits (VOB) stage onward',
      403
    )
  }
}
