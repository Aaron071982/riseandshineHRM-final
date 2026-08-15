import type {
  ClientOwnerDept,
  ClientStage,
  RequirementStatus,
} from '@prisma/client'

/** Ordered pipeline stages (inquiry → active). */
export const CLIENT_STAGE_ORDER: readonly ClientStage[] = [
  'INQUIRY',
  'INTAKE',
  'CONSENT',
  'DOCUMENTS',
  'BENEFITS',
  'ASSESSMENT',
  'TREATMENT_PLAN',
  'AUTHORIZATION',
  'APPROVED',
  'READY_FOR_STAFFING',
  'RBT_SEARCH',
  'RBT_ASSIGNED',
  'SCHEDULE_COORDINATION',
  'SCHEDULE_CONFIRMED',
  'PRE_START',
  'ACTIVE',
] as const

/** Default owning department per stage. */
export const STAGE_DEFAULT_OWNER_DEPT: Record<ClientStage, ClientOwnerDept> = {
  INQUIRY: 'INTAKE',
  INTAKE: 'INTAKE',
  CONSENT: 'INTAKE',
  DOCUMENTS: 'INTAKE',
  BENEFITS: 'CASE_COORDINATION',
  ASSESSMENT: 'CLINICAL',
  TREATMENT_PLAN: 'CLINICAL',
  AUTHORIZATION: 'AUTHORIZATION',
  APPROVED: 'AUTHORIZATION',
  READY_FOR_STAFFING: 'STAFFING',
  RBT_SEARCH: 'STAFFING',
  RBT_ASSIGNED: 'STAFFING',
  SCHEDULE_COORDINATION: 'CASE_COORDINATION',
  SCHEDULE_CONFIRMED: 'CASE_COORDINATION',
  PRE_START: 'CASE_COORDINATION',
  ACTIVE: 'CLINICAL',
}

/**
 * Gate requirement keys that must be satisfied before advancing past a stage.
 * Keys are seeded on `client_requirements.key` and checked by `canAdvance`.
 */
export const STAGE_GATE_REQUIREMENT_KEYS: Record<ClientStage, readonly string[]> = {
  INQUIRY: ['parent_contacted', 'inquiry_ack_sent'],
  INTAKE: ['intake_packet_complete', 'demographics_complete'],
  CONSENT: ['consent_form_signed', 'hipaa_ack'],
  DOCUMENTS: [
    'insurance_card',
    'medicaid_card',
    'diagnostic_eval',
    'physician_referral',
  ],
  BENEFITS: ['benefits_verified', 'eligibility_confirmed'],
  ASSESSMENT: ['assessment_scheduled', 'assessment_completed'],
  TREATMENT_PLAN: ['treatment_plan_drafted', 'treatment_plan_signed'],
  AUTHORIZATION: ['auth_packet_complete', 'auth_submitted'],
  APPROVED: ['auth_approved', 'rendering_provider_set'],
  READY_FOR_STAFFING: ['staffing_packet_ready', 'preferred_schedule_captured'],
  RBT_SEARCH: ['candidates_identified'],
  RBT_ASSIGNED: ['rbt_assigned', 'match_approved'],
  SCHEDULE_COORDINATION: ['schedule_proposed'],
  SCHEDULE_CONFIRMED: [
    'schedule_confirmed',
    'parent_schedule_confirmed',
    'bcba_assigned',
  ],
  PRE_START: ['meet_and_greet_done', 'start_date_set'],
  ACTIVE: [],
}

/** Display labels for pipeline stages. */
export const STAGE_LABELS: Record<ClientStage, string> = {
  INQUIRY: 'Inquiry',
  INTAKE: 'Intake',
  CONSENT: 'Consent',
  DOCUMENTS: 'Documents',
  BENEFITS: 'Benefits',
  ASSESSMENT: 'Assessment',
  TREATMENT_PLAN: 'Treatment plan',
  AUTHORIZATION: 'Authorization',
  APPROVED: 'Approved',
  READY_FOR_STAFFING: 'Ready for staffing',
  RBT_SEARCH: 'RBT search',
  RBT_ASSIGNED: 'RBT assigned',
  SCHEDULE_COORDINATION: 'Schedule coordination',
  SCHEDULE_CONFIRMED: 'Schedule confirmed',
  PRE_START: 'Pre-start',
  ACTIVE: 'Active',
}

export const OWNER_DEPT_LABELS: Record<ClientOwnerDept, string> = {
  INTAKE: 'Intake',
  CASE_COORDINATION: 'Case coordination',
  CLINICAL: 'Clinical',
  AUTHORIZATION: 'Authorization',
  STAFFING: 'Staffing',
}

/** Human-readable labels for gate keys (seed / UI). */
export const REQUIREMENT_KEY_LABELS: Record<string, string> = {
  parent_contacted: 'Parent contacted',
  inquiry_ack_sent: 'Inquiry acknowledgment sent',
  intake_packet_complete: 'Intake packet complete',
  demographics_complete: 'Demographics complete',
  consent_form_signed: 'Consent form signed',
  hipaa_ack: 'HIPAA acknowledgment',
  insurance_card: 'Insurance card',
  medicaid_card: 'Medicaid card',
  diagnostic_eval: 'Diagnostic evaluation',
  physician_referral: 'Physician referral',
  benefits_verified: 'Benefits verified',
  eligibility_confirmed: 'Eligibility confirmed',
  assessment_scheduled: 'Assessment scheduled',
  assessment_completed: 'Assessment completed',
  treatment_plan_drafted: 'Treatment plan drafted',
  treatment_plan_signed: 'Treatment plan signed',
  auth_packet_complete: 'Authorization packet complete',
  auth_submitted: 'Authorization submitted',
  auth_approved: 'Authorization approved',
  rendering_provider_set: 'Rendering provider set',
  staffing_packet_ready: 'Staffing packet ready',
  preferred_schedule_captured: 'Preferred schedule captured',
  candidates_identified: 'RBT candidates identified',
  rbt_assigned: 'RBT assigned',
  match_approved: 'Match approved',
  schedule_proposed: 'Schedule proposed',
  schedule_confirmed: 'Schedule confirmed',
  parent_schedule_confirmed: 'Parent confirmed schedule',
  bcba_assigned: 'BCBA assigned',
  meet_and_greet_done: 'Meet & greet completed',
  start_date_set: 'Service start date set',
}

const SATISFIED_REQUIREMENT_STATUSES: ReadonlySet<RequirementStatus> = new Set([
  'COMPLETE',
  'RECEIVED',
  'NOT_APPLICABLE',
])

export type AdvanceClientInput = {
  stage: ClientStage
}

export type AdvanceRequirementInput = {
  key: string
  stage: ClientStage
  status: RequirementStatus
  isRequiredToAdvance: boolean
}

export type CanAdvanceResult = {
  ok: boolean
  blockedBy: string[]
}

/**
 * Pure gate check: every `isRequiredToAdvance` requirement for the client's
 * current stage must be COMPLETE, RECEIVED, or NOT_APPLICABLE.
 */
export function canAdvance(
  client: AdvanceClientInput,
  requirements: AdvanceRequirementInput[]
): CanAdvanceResult {
  const blockedBy = requirements
    .filter(
      (r) =>
        r.stage === client.stage &&
        r.isRequiredToAdvance &&
        !SATISFIED_REQUIREMENT_STATUSES.has(r.status)
    )
    .map((r) => r.key)

  return { ok: blockedBy.length === 0, blockedBy }
}

export function stageIndex(stage: ClientStage): number {
  return CLIENT_STAGE_ORDER.indexOf(stage)
}

export function nextStage(stage: ClientStage): ClientStage | null {
  const i = stageIndex(stage)
  if (i < 0 || i >= CLIENT_STAGE_ORDER.length - 1) return null
  return CLIENT_STAGE_ORDER[i + 1]
}
