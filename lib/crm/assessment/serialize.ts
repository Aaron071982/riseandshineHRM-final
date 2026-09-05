import {
  assessmentSectionSchemas,
  type AssessmentSectionData,
  type AssessmentSectionKey,
} from '@/lib/crm/assessment/assessment.schema'
import {
  isLikelyLegacyAflsText,
  normalizeSkillsAssessmentType,
} from '@/lib/crm/assessment/afls'

/** Parse JSONB columns from DB into typed section data with defaults. */
export function parseAssessmentRecord(record: {
  summary: unknown
  treatmentRequest: unknown
  locationSchedule: unknown
  bioPsychosocial: unknown
  instruments: unknown
  presentLevels: unknown
  environmental: unknown
  responseToTx: unknown
  interventions: unknown
  behaviors: unknown
  goals: unknown
  parentTraining: unknown
  servicesProtocols: unknown
  transitionPlan: unknown
  coordination: unknown
  recommendations: unknown
  crisisPlan: unknown
  signatures: unknown
}): AssessmentSectionData {
  const keys = Object.keys(assessmentSectionSchemas) as AssessmentSectionKey[]
  const out = {} as Record<AssessmentSectionKey, AssessmentSectionData[AssessmentSectionKey]>
  for (const key of keys) {
    out[key] = assessmentSectionSchemas[key].parse(record[key] ?? {}) as AssessmentSectionData[typeof key]
  }

  const rawInstruments =
    record.instruments && typeof record.instruments === 'object'
      ? (record.instruments as Record<string, unknown>)
      : {}
  const next = out as AssessmentSectionData
  const inferredType = normalizeSkillsAssessmentType({
    rawType: rawInstruments.skillsAssessmentType,
    atecAssessment: next.instruments.atecAssessment,
    aflsAssessment: next.instruments.aflsAssessment,
    atecInterpretation: next.presentLevels.atec.interpretation,
  })

  next.instruments.skillsAssessmentType = inferredType

  const legacyJoined = [
    next.instruments.atecAssessment,
    next.presentLevels.atec.interpretation,
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim()

  if (
    inferredType === 'AFLS' &&
    !next.instruments.aflsAssessment.trim() &&
    isLikelyLegacyAflsText(legacyJoined)
  ) {
    next.instruments.aflsAssessment = next.instruments.atecAssessment || legacyJoined
    if (!next.presentLevels.afls.interpretation.trim()) {
      next.presentLevels.afls.interpretation =
        next.presentLevels.atec.interpretation || next.instruments.atecAssessment
    }
    next.presentLevels.afls.legacyMigratedFromAtec = true
  }

  return next
}
