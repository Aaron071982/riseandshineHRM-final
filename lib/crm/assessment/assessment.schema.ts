import { z } from 'zod'
import {
  BEHAVIOR_BASELINE_DEFAULT,
  DEFAULT_DIAGNOSIS,
  DEFAULT_SCHEDULE_ROWS,
  DEFAULT_TRANSITION_CRITERIA_ROWS,
  GROUP_PARENT_TRAINING_GRAPHS_NOTE,
  GROUP_PARENT_TRAINING_RATIONALE_DEFAULT,
  INTERVENTIONS_97155_DEFAULT,
  PARENT_INVOLVEMENT_DEFAULT,
  PARENT_TRAINING_SUMMARY_DEFAULT,
  BEHAVIOR_REDUCTION_ANALYSIS_DEFAULT,
  RESPONSE_TO_TREATMENT_DEFAULT,
  SERVICES_PROTOCOL_COORDINATION_OF_CARE,
  SERVICES_PROTOCOL_DIRECTION_OF_TECHNICIAN,
  SERVICES_PROTOCOL_GENERALIZATION,
  SERVICES_PROTOCOL_GROUP_PARENT_TRAINING,
  SERVICES_PROTOCOL_PARENT_TRAINING,
  SERVICES_PROTOCOL_REASSESSMENT,
  RECOMMENDATIONS_FOR_TREATMENT_DEFAULT,
  TRANSITION_COMMUNICATION_CRITERIA_DEFAULT,
  TRANSITION_DISCHARGE_DEFAULT,
  TRANSITION_MAINTENANCE_GENERALIZATION_DEFAULT,
  TRANSITION_PLAN_NARRATIVE_DEFAULT,
  TRANSITION_SOCIAL_CRITERIA_DEFAULT,
} from '@/lib/crm/assessment/boilerplate'

/** ISO date string (YYYY-MM-DD) or empty. */
export const optionalDateStringSchema = z.string().optional().default('')

export const optionalTextSchema = z.string().optional().default('')

/** §3.1 Initial Assessment Summary */
export const assessmentSummarySchema = z.object({
  patientName: optionalTextSchema,
  parentName: optionalTextSchema,
  diagnosis: z.string().optional().default(DEFAULT_DIAGNOSIS),
  comorbidDiagnosis: optionalTextSchema,
  dateOfBirth: optionalDateStringSchema,
  age: optionalTextSchema,
  referringProvider: optionalTextSchema,
  npi: optionalTextSchema,
  reportDate: optionalDateStringSchema,
  assessorName: optionalTextSchema,
  assessorEmail: optionalTextSchema,
  assessorPhone: optionalTextSchema,
})

/** §3.2 Treatment Requests + Treatment Intensity */
export const treatmentRequestSchema = z.object({
  hrs97151: optionalTextSchema,
  hrs97153Initial: optionalTextSchema,
  hrs97155Initial: optionalTextSchema,
  hrs97156: optionalTextSchema,
  hrs97157: optionalTextSchema,
  servicePeriod: optionalTextSchema,
})

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const weekdaySchema = z.enum(WEEKDAYS)

export const scheduleRowSchema = z.object({
  id: z.string(),
  serviceCode: optionalTextSchema,
  label: optionalTextSchema,
  schedule: z.record(weekdaySchema, optionalTextSchema).default({}),
})

/** §3.3 Location & Schedule */
export const locationScheduleSchema = z.object({
  primaryLocations: z
    .object({
      home: z.boolean().default(false),
      school: z.boolean().default(false),
      clinic: z.boolean().default(false),
      community: z.boolean().default(false),
      telehealth: z.boolean().default(false),
    })
    .default({}),
  scheduleRows: z.array(scheduleRowSchema).default([]),
})

/** §3.4 Bio-Psychosocial */
export const bioPsychosocialSchema = z.object({
  generalInformation: optionalTextSchema,
  familyStructure: optionalTextSchema,
  developmentalHistory: optionalTextSchema,
  medicalHistory: optionalTextSchema,
  reasonForAssessment: optionalTextSchema,
  medications: optionalTextSchema,
  allergies: optionalTextSchema,
  familyHistoryOfAutism: optionalTextSchema,
  educationalSetting: optionalTextSchema,
  parentInvolvement: z.string().optional().default(PARENT_INVOLVEMENT_DEFAULT),
})

/** §3.5 Instruments & Methods */
export const skillsAssessmentTypeSchema = z.preprocess(
  (value) => {
    if (value === 'BVMAP' || value === 'VBMAP' || value === 'VB-MAPP') return 'VB_MAPP'
    return value
  },
  z.enum(['AFLS', 'ATEC', 'VB_MAPP', 'OTHER']).optional().default('AFLS')
)

export const instrumentsSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const obj = raw as Record<string, unknown>
    if (
      !(typeof obj.vbMappAssessment === 'string' && obj.vbMappAssessment.trim()) &&
      typeof obj.bvmapAssessment === 'string' &&
      obj.bvmapAssessment.trim()
    ) {
      return { ...obj, vbMappAssessment: obj.bvmapAssessment }
    }
    return raw
  },
  z.object({
    skillsAssessmentType: skillsAssessmentTypeSchema,
    otherSkillsAssessmentLabel: optionalTextSchema,
    familyCaregiverInterview: optionalTextSchema,
    recordsReviewed: optionalTextSchema,
    vinelandCompletedDate: optionalDateStringSchema,
    fastAssessment: optionalTextSchema,
    aflsAssessment: optionalTextSchema,
    atecAssessment: optionalTextSchema,
    vbMappAssessment: optionalTextSchema,
    otherSkillsAssessmentSummary: optionalTextSchema,
    observation1: optionalTextSchema,
    observation2: optionalTextSchema,
    preferenceAssessment: optionalTextSchema,
  })
)

/** §3.6 Present Levels */
export const presentLevelInstrumentSchema = z.object({
  date: optionalDateStringSchema,
  interpretation: optionalTextSchema,
})

export const aflsSummaryScoreSchema = z.object({
  id: z.string(),
  date: optionalDateStringSchema,
  value: z.number().min(0).max(9999).nullable().optional().default(null),
})

export const aflsSkillScoreSchema = z.object({
  id: z.string(),
  date: optionalDateStringSchema,
  value: z
    .union([z.number().int().min(0).max(4), z.literal('N/A'), z.null()])
    .optional()
    .default(null),
})

export const aflsSkillSchema = z.object({
  id: z.string(),
  code: optionalTextSchema,
  label: optionalTextSchema,
  scores: z.array(aflsSkillScoreSchema).default([]),
})

export const aflsSkillAreaSchema = z.object({
  id: z.string(),
  code: optionalTextSchema,
  label: optionalTextSchema,
  summaryScores: z.array(aflsSummaryScoreSchema).default([]),
  skills: z.array(aflsSkillSchema).default([]),
})

export const aflsProtocolSchema = z.object({
  id: z.string(),
  key: optionalTextSchema,
  label: optionalTextSchema,
  summaryScores: z.array(aflsSummaryScoreSchema).default([]),
  skillAreas: z.array(aflsSkillAreaSchema).default([]),
})

export const aflsPresentLevelSchema = z.object({
  interpretation: optionalTextSchema,
  protocols: z.array(aflsProtocolSchema).default([]),
  legacyMigratedFromAtec: z.boolean().optional().default(false),
})

export const presentLevelsSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const obj = raw as Record<string, unknown>
    if (!obj.vbMapp && obj.bvmap) {
      return { ...obj, vbMapp: obj.bvmap }
    }
    return raw
  },
  z.object({
    vineland: presentLevelInstrumentSchema.default({}),
    afls: aflsPresentLevelSchema.default({}),
    atec: presentLevelInstrumentSchema.default({}),
    vbMapp: presentLevelInstrumentSchema.default({}),
    other: presentLevelInstrumentSchema.default({}),
    fast: presentLevelInstrumentSchema.default({}),
  })
)

/** §3.7 Environmental */
export const environmentalSchema = z.object({
  barriers: optionalTextSchema,
})

/** §3.8 Response to Treatment */
export const responseToTxSchema = z.object({
  narrative: z.string().optional().default(RESPONSE_TO_TREATMENT_DEFAULT),
})

/** §3.9 97155 Interventions */
export const interventionsSchema = z.object({
  narrative: z.string().optional().default(INTERVENTIONS_97155_DEFAULT),
})

export const behaviorMeasurementSchema = z.enum(['FREQUENCY', 'DURATION', 'BOTH'])

/** §3.10 Behavior block */
export const behaviorBlockSchema = z.object({
  id: z.string(),
  operationalDefinition: optionalTextSchema,
  severity: optionalTextSchema,
  example: optionalTextSchema,
  nonExample: optionalTextSchema,
  hypothesizedFunction: optionalTextSchema,
  onset: optionalTextSchema,
  offset: optionalTextSchema,
  measurement: behaviorMeasurementSchema.optional(),
  baselineMeasurement: z.string().optional().default(BEHAVIOR_BASELINE_DEFAULT),
  interventionPlans: optionalTextSchema,
  preventionStrategies: optionalTextSchema,
  replacementStrategies: optionalTextSchema,
  responseStrategies: optionalTextSchema,
  antecedentsSettingEvents: optionalTextSchema,
})

export const behaviorsSchema = z.object({
  blocks: z.array(behaviorBlockSchema).default([]),
})

/** Goal table column-set A (§3.11) */
export const goalRowColumnASchema = z.object({
  id: z.string(),
  goalName: optionalTextSchema,
  objective: optionalTextSchema,
  baseline: optionalTextSchema,
  previousAssessmentScore: optionalTextSchema,
  currentPerformance: optionalTextSchema,
  masteryCriteria: optionalTextSchema,
  targetMasteryDate: optionalTextSchema,
})

/** Goal table column-set B (§3.12) */
export const goalRowColumnBSchema = z.object({
  id: z.string(),
  goal: optionalTextSchema,
  baselinePerformance: optionalTextSchema,
  previousAssessmentPerformance: optionalTextSchema,
  currentPerformance: optionalTextSchema,
  masteryCriteria: optionalTextSchema,
  targetMasteryDate: optionalTextSchema,
  methodsToBeUtilized: optionalTextSchema,
})

/** §3.11 Treatment goals */
export const goalDomainColumnASchema = z.object({
  analysisNarrative: z.string().optional().default(BEHAVIOR_REDUCTION_ANALYSIS_DEFAULT),
  rows: z.array(goalRowColumnASchema).default([]),
})

export const goalDomainWithLevelColumnASchema = z.object({
  currentLevel: optionalTextSchema,
  rows: z.array(goalRowColumnASchema).default([]),
})

export const goalsSchema = z.object({
  behaviorReduction: goalDomainColumnASchema.default({}),
  replacementBehavior: z
    .object({
      rows: z.array(goalRowColumnASchema).default([]),
    })
    .default({}),
  communication: goalDomainWithLevelColumnASchema.default({}),
  social: goalDomainWithLevelColumnASchema.default({}),
  adaptive: goalDomainWithLevelColumnASchema.default({}),
  livingSelfHelp: goalDomainWithLevelColumnASchema.default({}),
})

/** §3.12 Parent Training */
export const parentTrainingSchema = z.object({
  summaryNarrative: z.string().optional().default(PARENT_TRAINING_SUMMARY_DEFAULT),
  summaryGoals: z.array(goalRowColumnBSchema).default([]),
  groupClinicalRationale: z
    .string()
    .optional()
    .default(GROUP_PARENT_TRAINING_RATIONALE_DEFAULT),
  groupGoals: z.array(goalRowColumnBSchema).default([]),
  groupGraphsNote: z.string().optional().default(GROUP_PARENT_TRAINING_GRAPHS_NOTE),
})

/** §3.13 Services Protocols */
export const servicesProtocolsSchema = z.object({
  directionOfTechnician: z
    .string()
    .optional()
    .default(SERVICES_PROTOCOL_DIRECTION_OF_TECHNICIAN),
  coordinationOfCare: z.string().optional().default(SERVICES_PROTOCOL_COORDINATION_OF_CARE),
  coordinationContacts: optionalTextSchema,
  parentTraining: z.string().optional().default(SERVICES_PROTOCOL_PARENT_TRAINING),
  groupParentTraining: z
    .string()
    .optional()
    .default(SERVICES_PROTOCOL_GROUP_PARENT_TRAINING),
  reAssessment: z.string().optional().default(SERVICES_PROTOCOL_REASSESSMENT),
  generalizationTransition: z.string().optional().default(SERVICES_PROTOCOL_GENERALIZATION),
})

export const transitionCriteriaRowSchema = z.object({
  id: z.string(),
  criteria: optionalTextSchema,
  directHoursChangeTo: optionalTextSchema,
  parentTrainingIncrease: optionalTextSchema,
  supervisionDecrease: optionalTextSchema,
  dateExpected: optionalTextSchema,
})

/** §3.14 Transition Plan */
export const transitionPlanSchema = z.object({
  maintenanceGeneralization: z
    .string()
    .optional()
    .default(TRANSITION_MAINTENANCE_GENERALIZATION_DEFAULT),
  transitionPlanNarrative: z.string().optional().default(TRANSITION_PLAN_NARRATIVE_DEFAULT),
  communicationCriteria: z
    .string()
    .optional()
    .default(TRANSITION_COMMUNICATION_CRITERIA_DEFAULT),
  socialCriteria: z.string().optional().default(TRANSITION_SOCIAL_CRITERIA_DEFAULT),
  criteriaRows: z.array(transitionCriteriaRowSchema).default([]),
  nextLevelOfCare: z
    .object({
      reducedIntensityAba: z.boolean().default(false),
      hybridHomeCommunity: z.boolean().default(false),
      parentMediatedIntervention: z.boolean().default(false),
      schoolConsultation: z.boolean().default(false),
      socialSkillsProgramming: z.boolean().default(false),
    })
    .default({}),
  dischargeNarrative: z.string().optional().default(TRANSITION_DISCHARGE_DEFAULT),
})

export const contactFieldSchema = z.object({
  name: optionalTextSchema,
  organization: optionalTextSchema,
  phone: optionalTextSchema,
  email: optionalTextSchema,
})

/** §3.15 Coordination of Care (table rows) */
export const coordinationRowSchema = z.object({
  id: z.string(),
  name: optionalTextSchema,
  phone: optionalTextSchema,
  date: optionalDateStringSchema,
  discussion: optionalTextSchema,
})

const LEGACY_COORDINATION_ROLES = [
  'speechTherapist',
  'occupationalTherapist',
  'classTeacher',
  'physicalTherapist',
  'primaryCareProvider',
] as const

function migrateCoordinationInput(raw: unknown): { rows: unknown[] } {
  if (!raw || typeof raw !== 'object') return { rows: [] }
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.rows)) return { rows: obj.rows }

  const rows: Array<{
    id: string
    name: string
    phone: string
    date: string
    discussion: string
  }> = []

  for (const role of LEGACY_COORDINATION_ROLES) {
    const contact = obj[role] as
      | { name?: string; phone?: string; organization?: string }
      | undefined
    if (!contact) continue
    const name = (contact.name ?? '').trim()
    const phone = (contact.phone ?? '').trim()
    if (!name && !phone) continue
    rows.push({
      id: `legacy-${role}`,
      name: name || role,
      phone,
      date: '',
      discussion: '',
    })
  }

  const members = Array.isArray(obj.additionalMembers) ? obj.additionalMembers : []
  for (const member of members) {
    if (!member || typeof member !== 'object') continue
    const m = member as {
      id?: string
      role?: string
      contact?: { name?: string; phone?: string }
    }
    const name = (m.contact?.name ?? m.role ?? '').trim()
    const phone = (m.contact?.phone ?? '').trim()
    if (!name && !phone) continue
    rows.push({
      id: m.id || `legacy-member-${rows.length}`,
      name,
      phone,
      date: '',
      discussion: '',
    })
  }

  return { rows }
}

export const coordinationSchema = z.preprocess(
  migrateCoordinationInput,
  z.object({
    rows: z.array(coordinationRowSchema).default([]),
  })
)

/** §3.16 Recommendations */
export const recommendationsSchema = z.object({
  narrative: z.string().optional().default(RECOMMENDATIONS_FOR_TREATMENT_DEFAULT),
})

/** §3.17 Crisis Plan */
export const crisisPlanSchema = z.object({
  riskFactors: z
    .object({
      assaultiveBehavior: z.boolean().default(false),
      selfInjuriousBehavior: z.boolean().default(false),
      fireSetting: z.boolean().default(false),
      impulsiveBehavior: z.boolean().default(false),
      selfMutilation: z.boolean().default(false),
      currentFamilyViolence: z.boolean().default(false),
      priorPsychiatricInpatient: z.boolean().default(false),
      elopement: z.boolean().default(false),
      sexuallyOffendingBehavior: z.boolean().default(false),
      currentSubstanceAbuse: z.boolean().default(false),
      psychoticSymptoms: z.boolean().default(false),
      caringForIllFamilyMember: z.boolean().default(false),
      copingWithSignificantLoss: z.boolean().default(false),
      other: z.boolean().default(false),
      otherText: optionalTextSchema,
    })
    .default({}),
})

export const signatureEntrySchema = z.object({
  name: optionalTextSchema,
  credentials: optionalTextSchema,
  signatureData: optionalTextSchema,
  signatureTypedName: optionalTextSchema,
  date: optionalDateStringSchema,
})

/** §3.18 Signatures */
export const signaturesSchema = z.object({
  bcba: signatureEntrySchema.default({}),
  graduatePermit: signatureEntrySchema.default({}),
  parentGuardian: signatureEntrySchema.default({}),
})

/** All JSONB section keys on ClientTreatmentAssessment. */
export const ASSESSMENT_SECTION_KEYS = [
  'summary',
  'treatmentRequest',
  'locationSchedule',
  'bioPsychosocial',
  'instruments',
  'presentLevels',
  'environmental',
  'responseToTx',
  'interventions',
  'behaviors',
  'goals',
  'parentTraining',
  'servicesProtocols',
  'transitionPlan',
  'coordination',
  'recommendations',
  'crisisPlan',
  'signatures',
] as const

export type AssessmentSectionKey = (typeof ASSESSMENT_SECTION_KEYS)[number]

export const assessmentSectionSchemas = {
  summary: assessmentSummarySchema,
  treatmentRequest: treatmentRequestSchema,
  locationSchedule: locationScheduleSchema,
  bioPsychosocial: bioPsychosocialSchema,
  instruments: instrumentsSchema,
  presentLevels: presentLevelsSchema,
  environmental: environmentalSchema,
  responseToTx: responseToTxSchema,
  interventions: interventionsSchema,
  behaviors: behaviorsSchema,
  goals: goalsSchema,
  parentTraining: parentTrainingSchema,
  servicesProtocols: servicesProtocolsSchema,
  transitionPlan: transitionPlanSchema,
  coordination: coordinationSchema,
  recommendations: recommendationsSchema,
  crisisPlan: crisisPlanSchema,
  signatures: signaturesSchema,
} as const satisfies Record<AssessmentSectionKey, z.ZodTypeAny>

export type AssessmentSummary = z.infer<typeof assessmentSummarySchema>
export type TreatmentRequest = z.infer<typeof treatmentRequestSchema>
export type LocationSchedule = z.infer<typeof locationScheduleSchema>
export type BioPsychosocial = z.infer<typeof bioPsychosocialSchema>
export type Instruments = z.infer<typeof instrumentsSchema>
export type PresentLevels = z.infer<typeof presentLevelsSchema>
export type SkillsAssessmentType = 'AFLS' | 'ATEC' | 'VB_MAPP' | 'OTHER'
export type AflsSummaryScore = z.infer<typeof aflsSummaryScoreSchema>
export type AflsSkillScore = z.infer<typeof aflsSkillScoreSchema>
export type AflsSkill = z.infer<typeof aflsSkillSchema>
export type AflsSkillArea = z.infer<typeof aflsSkillAreaSchema>
export type AflsProtocol = z.infer<typeof aflsProtocolSchema>
export type AflsPresentLevel = z.infer<typeof aflsPresentLevelSchema>
export type Environmental = z.infer<typeof environmentalSchema>
export type ResponseToTx = z.infer<typeof responseToTxSchema>
export type Interventions = z.infer<typeof interventionsSchema>
export type BehaviorBlock = z.infer<typeof behaviorBlockSchema>
export type Behaviors = z.infer<typeof behaviorsSchema>
export type GoalRowColumnA = z.infer<typeof goalRowColumnASchema>
export type GoalRowColumnB = z.infer<typeof goalRowColumnBSchema>
export type Goals = z.infer<typeof goalsSchema>
export type ParentTraining = z.infer<typeof parentTrainingSchema>
export type ServicesProtocols = z.infer<typeof servicesProtocolsSchema>
export type TransitionPlan = z.infer<typeof transitionPlanSchema>
export type Coordination = z.infer<typeof coordinationSchema>
export type Recommendations = z.infer<typeof recommendationsSchema>
export type CrisisPlan = z.infer<typeof crisisPlanSchema>
export type Signatures = z.infer<typeof signaturesSchema>
export type ContactField = z.infer<typeof contactFieldSchema>

export type AssessmentSectionData = {
  [K in AssessmentSectionKey]: z.infer<(typeof assessmentSectionSchemas)[K]>
}

/** Partial patch of one or more sections (autosave). */
export const assessmentPatchSchema = z
  .object(
    Object.fromEntries(
      ASSESSMENT_SECTION_KEYS.map((key) => [
        key,
        assessmentSectionSchemas[key].optional(),
      ])
    ) as {
      [K in AssessmentSectionKey]: z.ZodOptional<
        (typeof assessmentSectionSchemas)[K]
      >
    }
  )
  .strict()

export type AssessmentPatch = z.infer<typeof assessmentPatchSchema>

export const assessmentAttachmentKindSchema = z.enum(['IMAGE', 'PDF'])

export type AssessmentAttachmentKind = z.infer<typeof assessmentAttachmentKindSchema>

export function isAssessmentSectionKey(value: string): value is AssessmentSectionKey {
  return (ASSESSMENT_SECTION_KEYS as readonly string[]).includes(value)
}

export function parseAssessmentSection<K extends AssessmentSectionKey>(
  key: K,
  data: unknown
): AssessmentSectionData[K] {
  return assessmentSectionSchemas[key].parse(data) as AssessmentSectionData[K]
}

export function safeParseAssessmentSection<K extends AssessmentSectionKey>(
  key: K,
  data: unknown
): { success: true; data: AssessmentSectionData[K] } | { success: false; error: z.ZodError } {
  const result = assessmentSectionSchemas[key].safeParse(data)
  if (result.success) {
    return { success: true, data: result.data as AssessmentSectionData[K] }
  }
  return { success: false, error: result.error }
}

export function parseAssessmentPatch(data: unknown): AssessmentPatch {
  return assessmentPatchSchema.parse(data)
}

export function safeParseAssessmentPatch(
  data: unknown
): { success: true; data: AssessmentPatch } | { success: false; error: z.ZodError } {
  const result = assessmentPatchSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

function newId(): string {
  return crypto.randomUUID()
}

export function emptyBehaviorBlock(): BehaviorBlock {
  return behaviorBlockSchema.parse({ id: newId() })
}

export function emptyScheduleRow(
  serviceCode: string,
  label: string
): z.infer<typeof scheduleRowSchema> {
  return scheduleRowSchema.parse({
    id: newId(),
    serviceCode,
    label,
    schedule: {},
  })
}

export function emptyTransitionCriteriaRow(): z.infer<typeof transitionCriteriaRowSchema> {
  return transitionCriteriaRowSchema.parse({ id: newId() })
}

export function emptyCoordinationRow(): z.infer<typeof coordinationRowSchema> {
  return coordinationRowSchema.parse({ id: newId() })
}

export function emptyAflsSummaryScore(): AflsSummaryScore {
  return aflsSummaryScoreSchema.parse({ id: newId() })
}

export function emptyAflsSkillScore(date = ''): AflsSkillScore {
  return aflsSkillScoreSchema.parse({ id: newId(), date })
}

export function emptyAflsSkill(): AflsSkill {
  return aflsSkillSchema.parse({ id: newId() })
}

export function emptyAflsSkillArea(): AflsSkillArea {
  return aflsSkillAreaSchema.parse({ id: newId() })
}

export function emptyAflsProtocol(): AflsProtocol {
  return aflsProtocolSchema.parse({ id: newId() })
}

/** Default section payloads for a new FORM assessment. */
export function defaultAssessmentSections(): AssessmentSectionData {
  return {
    summary: assessmentSummarySchema.parse({}),
    treatmentRequest: treatmentRequestSchema.parse({}),
    locationSchedule: locationScheduleSchema.parse({
      scheduleRows: DEFAULT_SCHEDULE_ROWS.map((row) =>
        emptyScheduleRow(row.serviceCode, row.label)
      ),
    }),
    bioPsychosocial: bioPsychosocialSchema.parse({}),
    instruments: instrumentsSchema.parse({}),
    presentLevels: presentLevelsSchema.parse({}),
    environmental: environmentalSchema.parse({}),
    responseToTx: responseToTxSchema.parse({}),
    interventions: interventionsSchema.parse({}),
    behaviors: behaviorsSchema.parse({
      blocks: [emptyBehaviorBlock(), emptyBehaviorBlock(), emptyBehaviorBlock()],
    }),
    goals: goalsSchema.parse({}),
    parentTraining: parentTrainingSchema.parse({}),
    servicesProtocols: servicesProtocolsSchema.parse({}),
    transitionPlan: transitionPlanSchema.parse({
      criteriaRows: DEFAULT_TRANSITION_CRITERIA_ROWS.map((row) =>
        transitionCriteriaRowSchema.parse({ id: newId(), ...row })
      ),
    }),
    coordination: coordinationSchema.parse({}),
    recommendations: recommendationsSchema.parse({}),
    crisisPlan: crisisPlanSchema.parse({}),
    signatures: signaturesSchema.parse({}),
  }
}
