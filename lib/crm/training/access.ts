import {
  CrmAccessError,
  isFullAccess,
  isSuperAdmin,
  type CrmAccessSubject,
} from '@/lib/crm/access'

export { TRAINING_MODULE_ROLE_LABELS } from '@/lib/crm/training/constants'

export function canViewStaffProfile(
  viewer: CrmAccessSubject,
  targetUserId: string
): boolean {
  if (viewer.id === targetUserId) return true
  return isFullAccess(viewer) || isSuperAdmin(viewer)
}

export function assertCanViewStaffProfile(
  viewer: CrmAccessSubject,
  targetUserId: string
): void {
  if (!canViewStaffProfile(viewer, targetUserId)) {
    throw new CrmAccessError('You can only view your own profile', 403)
  }
}

export function canEditTrainingContent(viewer: CrmAccessSubject): boolean {
  return isFullAccess(viewer) || isSuperAdmin(viewer)
}

export function assertCanEditTrainingContent(viewer: CrmAccessSubject): void {
  if (!canEditTrainingContent(viewer)) {
    throw new CrmAccessError('Training content editing requires full access', 403)
  }
}

export function assertCanToggleTrainingCompletion(
  viewer: CrmAccessSubject,
  targetUserId: string
): void {
  if (viewer.id !== targetUserId) {
    throw new CrmAccessError('You can only update your own training progress', 403)
  }
}
