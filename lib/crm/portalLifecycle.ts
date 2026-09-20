import type { ClientStage } from '@prisma/client'
import { LINEAR_STAGE_ORDER, STAGE_GROUP } from '@/lib/crm/stages'

/**
 * BCBA-facing lifecycle (visibility strip). Order matches how BCBAs experience
 * the case: wait through intake → wait through authorization → do assessment →
 * therapist search follows.
 */
export type PortalLifecycleStageId =
  | 'INTAKE'
  | 'AUTHORIZATION'
  | 'READY_FOR_ASSESSMENT'
  | 'THERAPIST_SEARCH'

export type PortalLifecycleStageDef = {
  id: PortalLifecycleStageId
  label: string
  shortLabel: string
}

export const PORTAL_LIFECYCLE_STAGES: readonly PortalLifecycleStageDef[] = [
  { id: 'INTAKE', label: 'Intake', shortLabel: 'Intake' },
  { id: 'AUTHORIZATION', label: 'Authorization', shortLabel: 'Authorization' },
  {
    id: 'READY_FOR_ASSESSMENT',
    label: 'Ready for assessment',
    shortLabel: 'Ready for assessment',
  },
  {
    id: 'THERAPIST_SEARCH',
    label: 'Therapist search',
    shortLabel: 'Therapist search',
  },
] as const

export type PortalLifecycleInput = {
  stage: ClientStage | string
  /** Latest treatment assessment status, if any. */
  assessmentStatus?: string | null
  /** Active care-team BT rows (status ACTIVE, not deleted). */
  hasTherapistAssigned?: boolean
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

/** Past intake group (INQUIRY → BENEFITS). */
export function isPortalIntakeDone(stage: ClientStage | string): boolean {
  const s = stage as ClientStage
  if (STAGE_GROUP[s] === 'INTAKE') return false
  const idx = linearIdx(s)
  return idx >= 0
}

/**
 * Authorization phase cleared: reached AUTHORIZATION/APPROVED, or assessment
 * has already started (BCBA enters at assessment after intake wait).
 */
export function isPortalAuthorizationDone(stage: ClientStage | string): boolean {
  const s = stage as ClientStage
  const idx = linearIdx(s)
  const authIdx = linearIdx('AUTHORIZATION')
  const assessIdx = linearIdx('ASSESSMENT')
  if (idx < 0) return false
  if (authIdx >= 0 && idx >= authIdx) return true
  if (assessIdx >= 0 && idx >= assessIdx) return true
  return false
}

/** Client has reached the ASSESSMENT stage (BCBA’s first active phase). */
export function isPortalReadyForAssessment(stage: ClientStage | string): boolean {
  const s = stage as ClientStage
  if (s === 'ASSESSMENT' || s === 'TREATMENT_PLAN') return true
  const idx = linearIdx(s)
  const assessIdx = linearIdx('ASSESSMENT')
  return idx >= 0 && assessIdx >= 0 && idx >= assessIdx
}

/** Assessment phase finished — moved past ASSESSMENT or assessment signed/completed. */
export function isPortalAssessmentPhaseDone(
  stage: ClientStage | string,
  assessmentStatus?: string | null
): boolean {
  const s = stage as ClientStage
  if (assessmentStatus === 'COMPLETED' || assessmentStatus === 'SIGNED') return true
  const idx = linearIdx(s)
  const assessIdx = linearIdx('ASSESSMENT')
  // Past assessment in the linear pipeline (authorization onward, or staffing).
  if (idx >= 0 && assessIdx >= 0 && idx > assessIdx && s !== 'TREATMENT_PLAN') {
    return true
  }
  return false
}

/** Staffing / therapist search underway or complete. */
export function isPortalTherapistSearchReached(
  stage: ClientStage | string,
  hasTherapistAssigned?: boolean
): boolean {
  if (hasTherapistAssigned) return true
  const s = stage as ClientStage
  const g = STAGE_GROUP[s]
  if (g === 'STAFFING' || g === 'COORDINATION' || g === 'ACTIVE') return true
  const idx = linearIdx(s)
  const staffIdx = linearIdx('READY_FOR_STAFFING')
  return idx >= 0 && staffIdx >= 0 && idx >= staffIdx
}

export function derivePortalLifecycle(
  input: PortalLifecycleInput
): PortalLifecycleSnapshot {
  const intakeDone = isPortalIntakeDone(input.stage)
  const authDone = isPortalAuthorizationDone(input.stage)
  const readyReached = isPortalReadyForAssessment(input.stage)
  const assessmentDone = isPortalAssessmentPhaseDone(
    input.stage,
    input.assessmentStatus
  )
  const therapistReached = isPortalTherapistSearchReached(
    input.stage,
    input.hasTherapistAssigned
  )

  // Done = phase completed (moved past). For ready, "done" means assessment finished.
  const doneFlags: boolean[] = [
    intakeDone,
    authDone,
    assessmentDone,
    therapistReached && assessmentDone,
  ]

  const stages = PORTAL_LIFECYCLE_STAGES.map((def, i) => ({
    id: def.id,
    label: def.label,
    shortLabel: def.shortLabel,
    done: doneFlags[i]!,
  }))

  // Current = first incomplete; if on ASSESSMENT, force ready even if auth just cleared.
  let currentIndex = 0
  for (let i = 0; i < doneFlags.length; i++) {
    if (!doneFlags[i]) {
      currentIndex = i
      break
    }
    currentIndex = i
  }

  // Prefer highlighting Ready while the BCBA is actively on ASSESSMENT.
  if (
    readyReached &&
    !assessmentDone &&
    (input.stage === 'ASSESSMENT' || input.stage === 'TREATMENT_PLAN')
  ) {
    currentIndex = 2
  }

  const current = stages[currentIndex]!
  return {
    stages,
    currentIndex,
    currentId: current.id,
    currentLabel: current.shortLabel,
  }
}
