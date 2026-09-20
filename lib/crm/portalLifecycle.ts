import type { ClientStage } from '@prisma/client'
import { LINEAR_STAGE_ORDER, STAGE_GROUP } from '@/lib/crm/stages'

export type PortalLifecycleStageId =
  | 'ASSIGNED'
  | 'THERAPIST_ASSIGNED'
  | 'IN_COORDINATION'
  | 'READY_FOR_ASSESSMENT'

export type PortalLifecycleStageDef = {
  id: PortalLifecycleStageId
  label: string
  shortLabel: string
}

export const PORTAL_LIFECYCLE_STAGES: readonly PortalLifecycleStageDef[] = [
  { id: 'ASSIGNED', label: 'Assigned', shortLabel: 'Assigned' },
  { id: 'THERAPIST_ASSIGNED', label: 'Therapist assigned', shortLabel: 'Therapist' },
  { id: 'IN_COORDINATION', label: 'In case coordination', shortLabel: 'In coordination' },
  {
    id: 'READY_FOR_ASSESSMENT',
    label: 'Ready for assessment',
    shortLabel: 'Ready for assessment',
  },
] as const

export type PortalLifecycleInput = {
  assignedBcbaId: string | null
  stage: ClientStage | string
  /** Active care-team BT rows (status ACTIVE, not deleted). */
  hasTherapistAssigned: boolean
}

export type PortalLifecycleSnapshot = {
  stages: {
    id: PortalLifecycleStageId
    label: string
    shortLabel: string
    done: boolean
  }[]
  /** Index of current (first incomplete, or last if all done). */
  currentIndex: number
  currentId: PortalLifecycleStageId
  currentLabel: string
}

function linearIdx(stage: ClientStage | string): number {
  return LINEAR_STAGE_ORDER.indexOf(stage as ClientStage)
}

/** Case-coordination CRM stages (plus ACTIVE = past coordination). */
export function isPortalCoordinationStage(stage: ClientStage | string): boolean {
  const s = stage as ClientStage
  if (STAGE_GROUP[s] === 'COORDINATION') return true
  if (s === 'ACTIVE') return true
  const idx = linearIdx(s)
  const coordIdx = linearIdx('SCHEDULE_COORDINATION')
  return idx >= 0 && coordIdx >= 0 && idx >= coordIdx
}

/**
 * Ready-for-assessment: client has reached the ASSESSMENT stage (or later
 * clinical/auth). Source of truth = CRM `ClientStage`.
 */
export function isPortalReadyForAssessment(stage: ClientStage | string): boolean {
  const s = stage as ClientStage
  if (s === 'ASSESSMENT') return true
  if (STAGE_GROUP[s] === 'CLINICAL_AUTH') return true
  const idx = linearIdx(s)
  const assessIdx = linearIdx('ASSESSMENT')
  return idx >= 0 && assessIdx >= 0 && idx >= assessIdx
}

export function derivePortalLifecycle(
  input: PortalLifecycleInput
): PortalLifecycleSnapshot {
  const doneFlags: boolean[] = [
    !!input.assignedBcbaId,
    input.hasTherapistAssigned,
    isPortalCoordinationStage(input.stage),
    isPortalReadyForAssessment(input.stage),
  ]

  const stages = PORTAL_LIFECYCLE_STAGES.map((def, i) => ({
    id: def.id,
    label: def.label,
    shortLabel: def.shortLabel,
    done: doneFlags[i]!,
  }))

  let currentIndex = 0
  for (let i = 0; i < doneFlags.length; i++) {
    if (!doneFlags[i]) {
      currentIndex = i
      break
    }
    currentIndex = i
  }

  const current = stages[currentIndex]!
  return {
    stages,
    currentIndex,
    currentId: current.id,
    currentLabel: current.shortLabel,
  }
}
