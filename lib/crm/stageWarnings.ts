import type { AuthStatus, AuthType, ClientStage, MilestoneStatus } from '@prisma/client'
import { stageIndex } from '@/lib/crm/stages'

export const STAGE_WARNING_CODES = [
  'pa_not_on_file',
  'treatment_plan_incomplete',
] as const

export type StageWarningCode = (typeof STAGE_WARNING_CODES)[number]

export type StageWarning = {
  code: StageWarningCode
  message: string
}

type AuthSnapshot = {
  authType: AuthType
  status: AuthStatus
  deletedAt: Date | null
}

export function isAssessmentPaOnFile(authorizations: AuthSnapshot[]): boolean {
  const assessment = authorizations.find(
    (a) => a.authType === 'ASSESSMENT' && !a.deletedAt
  )
  if (!assessment) return false
  return assessment.status === 'APPROVED'
}

/** True when the transition crosses into assessment work without PA on file. */
export function crossesAssessmentAuthPoint(
  fromStage: ClientStage,
  toStage: ClientStage
): boolean {
  return (
    stageIndex(toStage) >= stageIndex('ASSESSMENT') &&
    stageIndex(fromStage) < stageIndex('ASSESSMENT')
  )
}

export function computeStageAdvanceWarnings(input: {
  fromStage: ClientStage
  toStage: ClientStage
  authRequired: boolean
  treatmentPlanStatus: MilestoneStatus
  authorizations: AuthSnapshot[]
}): StageWarning[] {
  const warnings: StageWarning[] = []

  if (
    input.authRequired &&
    crossesAssessmentAuthPoint(input.fromStage, input.toStage) &&
    !isAssessmentPaOnFile(input.authorizations)
  ) {
    warnings.push({
      code: 'pa_not_on_file',
      message:
        'Prior auth (assessment / 97151) is not on file — proceed anyway?',
    })
  }

  if (
    input.toStage === 'ACTIVE' &&
    input.treatmentPlanStatus !== 'COMPLETE'
  ) {
    warnings.push({
      code: 'treatment_plan_incomplete',
      message:
        'Treatment plan is not marked complete — start services anyway?',
    })
  }

  return warnings
}

export function warningsAcknowledged(
  warnings: StageWarning[],
  overrides: StageWarningCode[] | undefined
): boolean {
  if (warnings.length === 0) return true
  const set = new Set(overrides ?? [])
  return warnings.every((w) => set.has(w.code))
}
