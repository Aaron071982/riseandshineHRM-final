import {
  assessmentSectionSchemas,
  type AssessmentSectionData,
  type AssessmentSectionKey,
} from '@/lib/crm/assessment/assessment.schema'

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
  return out as AssessmentSectionData
}
