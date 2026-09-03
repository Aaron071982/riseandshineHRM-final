import type { ClientStage, PostHireStage, RBTStatus } from '@prisma/client'
import type { NeedsStaffingReason } from '@/lib/crm/staffing/needsStaffing'
import {
  STAGE_GROUP,
  STAGE_GROUP_LABELS,
  STAGE_LABELS,
  type StageGroupId,
} from '@/lib/crm/stages'
import type {
  ClientMarkerColor,
  TherapistMarkerColor,
} from '@/lib/crm/therapistClientMap/types'

/** Hex colors aligned with CRM stage-group accents in globals.css */
export const CLIENT_STAGE_GROUP_HEX: Record<StageGroupId, string> = {
  INTAKE: '#2a6ae0',
  CLINICAL_AUTH: '#7c3aed',
  STAFFING: '#e85a1c',
  COORDINATION: '#c97a00',
  ACTIVE: '#2f9e44',
}

export const THERAPIST_MARKER_HEX: Record<TherapistMarkerColor, string> = {
  green: '#16a34a',
  red: '#dc2626',
}

/**
 * Green = HRM "Actively working" tag (`postHireStage === ACTIVE_DELIVERY`).
 * Red = everyone else on the map (hired-but-not-active, interview, etc.).
 * Matches Admin RBT profile / Kanban actively-working controls.
 */
export function therapistMarkerColor(
  postHireStage: PostHireStage | null | undefined
): TherapistMarkerColor {
  return postHireStage === 'ACTIVE_DELIVERY' ? 'green' : 'red'
}

export function therapistStatusLabel(
  postHireStage: PostHireStage | null | undefined,
  status: RBTStatus
): string {
  if (postHireStage === 'ACTIVE_DELIVERY') return 'Actively working'
  if (status === 'HIRED' || status === 'ONBOARDING_COMPLETED') {
    return 'Not actively working'
  }
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
  return 'Not actively working'
}

export function clientMarkerFromStage(stage: ClientStage): {
  stageGroup: StageGroupId
  markerColor: ClientMarkerColor
  markerHex: string
  statusLabel: string
} {
  const stageGroup = STAGE_GROUP[stage]
  return {
    stageGroup,
    markerColor: stageGroup,
    markerHex: CLIENT_STAGE_GROUP_HEX[stageGroup],
    statusLabel: STAGE_LABELS[stage],
  }
}

export function clientStageGroupLabel(stageGroup: StageGroupId): string {
  return STAGE_GROUP_LABELS[stageGroup]
}

/** Detail panel helper when staffing flags apply. */
export function clientStaffingNote(
  needsStaffing: boolean,
  reasons: NeedsStaffingReason[]
): string | null {
  if (!needsStaffing) return null
  if (reasons.includes('losing_staff_soon')) return 'Losing staff soon'
  if (reasons.includes('understaffed')) return 'Needs more hours'
  if (reasons.includes('unstaffed')) return 'Needs staffing'
  return 'Needs staffing'
}
