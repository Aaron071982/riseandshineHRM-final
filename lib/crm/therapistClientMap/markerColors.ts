import type { RBTStatus } from '@prisma/client'
import type { NeedsStaffingReason } from '@/lib/crm/staffing/needsStaffing'
import type {
  ClientMarkerColor,
  TherapistMarkerColor,
} from '@/lib/crm/therapistClientMap/types'

const HIRED_STATUSES: readonly RBTStatus[] = ['HIRED', 'ONBOARDING_COMPLETED']

export function therapistMarkerColor(status: RBTStatus): TherapistMarkerColor {
  return HIRED_STATUSES.includes(status) ? 'green' : 'blue'
}

export function therapistStatusLabel(status: RBTStatus): string {
  if (status === 'HIRED' || status === 'ONBOARDING_COMPLETED') return 'Hired'
  if (
    status === 'TO_INTERVIEW' ||
    status === 'INTERVIEW_SCHEDULED' ||
    status === 'INTERVIEW_COMPLETED'
  ) {
    return 'Interview pipeline'
  }
  if (
    status === 'REACH_OUT' ||
    status === 'REACH_OUT_EMAIL_SENT' ||
    status === 'NEW'
  ) {
    return 'Reach-out pipeline'
  }
  if (status === 'STALLED') return 'Stalled'
  return 'Hiring pipeline'
}

export function clientMarkerColor(needsStaffing: boolean): ClientMarkerColor {
  return needsStaffing ? 'orange' : 'black'
}

export function clientStatusLabel(
  needsStaffing: boolean,
  reasons: NeedsStaffingReason[]
): string {
  if (!needsStaffing) return 'Staffed / settled'
  if (reasons.includes('losing_staff_soon')) return 'Losing staff soon'
  if (reasons.includes('understaffed')) return 'Needs more hours'
  if (reasons.includes('unstaffed')) return 'Needs staffing'
  return 'Needs staffing'
}
