import type {
  ClientOwnerDept,
  ClientStage,
  MilestoneStatus,
  RequirementStatus,
} from '@prisma/client'

/**
 * Full enum order (16 values). TREATMENT_PLAN remains in the enum for
 * history / legacy rows but is a parallel clinical track — not linear.
 */
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

/**
 * Linear pipeline for advance / funnel / stepper.
 * Skips TREATMENT_PLAN (parallel milestone).
 */
export const LINEAR_STAGE_ORDER: readonly ClientStage[] = [
  'INQUIRY',
  'INTAKE',
  'CONSENT',
  'DOCUMENTS',
  'BENEFITS',
  'ASSESSMENT',
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

export type StageGroupId =
  | 'INTAKE'
  | 'CLINICAL_AUTH'
  | 'STAFFING'
  | 'COORDINATION'
  | 'ACTIVE'

export const STAGE_GROUP_LABELS: Record<StageGroupId, string> = {
  INTAKE: 'Intake',
  CLINICAL_AUTH: 'Clinical / Auth',
  STAFFING: 'Staffing',
  COORDINATION: 'Coordination',
  ACTIVE: 'Active',
}

export const STAGE_GROUP: Record<ClientStage, StageGroupId> = {
  INQUIRY: 'INTAKE',
  INTAKE: 'INTAKE',
  CONSENT: 'INTAKE',
  DOCUMENTS: 'INTAKE',
  BENEFITS: 'INTAKE',
  ASSESSMENT: 'CLINICAL_AUTH',
  TREATMENT_PLAN: 'CLINICAL_AUTH',
  AUTHORIZATION: 'CLINICAL_AUTH',
  APPROVED: 'CLINICAL_AUTH',
  READY_FOR_STAFFING: 'STAFFING',
  RBT_SEARCH: 'STAFFING',
  RBT_ASSIGNED: 'STAFFING',
  SCHEDULE_COORDINATION: 'COORDINATION',
  SCHEDULE_CONFIRMED: 'COORDINATION',
  PRE_START: 'COORDINATION',
  ACTIVE: 'ACTIVE',
}

/** Stages belonging to each display group (linear only; TP is parallel). */
export const STAGE_GROUP_STAGES: Record<StageGroupId, readonly ClientStage[]> = {
  INTAKE: ['INQUIRY', 'INTAKE', 'CONSENT', 'DOCUMENTS', 'BENEFITS'],
  CLINICAL_AUTH: ['ASSESSMENT', 'AUTHORIZATION', 'APPROVED'],
  STAFFING: ['READY_FOR_STAFFING', 'RBT_SEARCH', 'RBT_ASSIGNED'],
  COORDINATION: ['SCHEDULE_COORDINATION', 'SCHEDULE_CONFIRMED', 'PRE_START'],
  ACTIVE: ['ACTIVE'],
}

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
 * TREATMENT_PLAN stage keys are legacy; the parallel milestone uses treatmentPlanStatus.
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

/** Standard DOCUMENT requirements seeded on create (PENDING). */
export const STANDARD_DOCUMENT_REQUIREMENT_KEYS = [
  'insurance_card',
  'medicaid_card',
  'diagnostic_eval',
  'physician_referral',
  'iep_ifsp',
  'custody_guardian',
  'prior_aba_records',
] as const

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

/** Plain-language stage descriptions for funnel / stepper (new-hire friendly). */
export const STAGE_DESCRIPTIONS: Record<ClientStage, string> = {
  INQUIRY:
    'A new family has reached out. Intake owns first contact and acknowledgment; advance once the parent has been reached and the inquiry ack is logged.',
  INTAKE:
    'Gather demographics and the intake packet. Intake completes the packet so consent and documents can start.',
  CONSENT:
    'Collect signed consent and HIPAA acknowledgment. Intake owns this gate before document collection.',
  DOCUMENTS:
    'Collect insurance, Medicaid, diagnostic eval, and physician referral. Missing docs block benefits verification.',
  BENEFITS:
    'Verify insurance eligibility and benefits. Case coordination confirms coverage before clinical assessment.',
  ASSESSMENT:
    'Schedule and complete the clinical assessment. Clinical owns this stage; completion unlocks authorization work.',
  TREATMENT_PLAN:
    'Clinical drafts and signs the treatment plan in parallel with auth and staffing — it does not block RBT placement, but must be complete before Active.',
  AUTHORIZATION:
    'Build and submit the auth packet. Authorization owns this stage; set an RBT target date so staffing has a deadline.',
  APPROVED:
    'Auth is approved and the rendering provider is set. Ready to hand off to staffing with a Case Coordinator assigned at the next stage.',
  READY_FOR_STAFFING:
    'Case Coordinator is assigned and the staffing packet is ready. Staffing begins the RBT search from here.',
  RBT_SEARCH:
    'Identify and screen RBT candidates against schedule and preference fields. Staffing owns the search.',
  RBT_ASSIGNED:
    'An RBT is matched and approved. Staffing confirms the assignment before schedule coordination.',
  SCHEDULE_COORDINATION:
    'Propose a weekly schedule with the family and clinical team. Case coordination owns the proposal.',
  SCHEDULE_CONFIRMED:
    'Parent and BCBA confirm the schedule. Case coordination locks start logistics.',
  PRE_START:
    'Meet-and-greet done and service start date set. Final checks before services begin.',
  ACTIVE:
    'Services are live. Clinical owns ongoing care; treatment plan must already be complete to enter this stage.',
}

export const OWNER_DEPT_LABELS: Record<ClientOwnerDept, string> = {
  INTAKE: 'Intake',
  CASE_COORDINATION: 'Case coordination',
  CLINICAL: 'Clinical',
  AUTHORIZATION: 'Authorization',
  STAFFING: 'Staffing',
  BILLING: 'Billing',
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
  iep_ifsp: 'IEP / IFSP',
  custody_guardian: 'Custody / guardian docs',
  prior_aba_records: 'Prior ABA records',
  benefits_verified: 'Benefits verified',
  eligibility_confirmed: 'Eligibility confirmed',
  assessment_scheduled: 'Assessment scheduled',
  assessment_completed: 'Assessment completed',
  treatment_plan_drafted: 'Treatment plan drafted',
  treatment_plan_signed: 'Treatment plan signed',
  treatment_plan_complete: 'Treatment plan complete (parallel track)',
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
  treatmentPlanStatus?: MilestoneStatus | null
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
 * Entering ACTIVE also requires treatmentPlanStatus === COMPLETE.
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

  const upcoming = nextStage(client.stage)
  if (
    upcoming === 'ACTIVE' &&
    client.treatmentPlanStatus !== 'COMPLETE'
  ) {
    blockedBy.push('treatment_plan_complete')
  }

  return { ok: blockedBy.length === 0, blockedBy }
}

export function stageIndex(stage: ClientStage): number {
  const linear = LINEAR_STAGE_ORDER.indexOf(stage)
  if (linear >= 0) return linear
  // Legacy TREATMENT_PLAN rows: treat as between Assessment and Authorization
  if (stage === 'TREATMENT_PLAN') {
    return LINEAR_STAGE_ORDER.indexOf('ASSESSMENT')
  }
  return CLIENT_STAGE_ORDER.indexOf(stage)
}

export function nextStage(stage: ClientStage): ClientStage | null {
  let from = stage
  if (from === 'TREATMENT_PLAN') from = 'ASSESSMENT'
  const i = LINEAR_STAGE_ORDER.indexOf(from)
  if (i < 0 || i >= LINEAR_STAGE_ORDER.length - 1) return null
  return LINEAR_STAGE_ORDER[i + 1]
}

/** Stages at or after Authorization may set rbtTargetDate. */
export function canSetRbtTargetDate(stage: ClientStage): boolean {
  const i = stageIndex(stage)
  const authIdx = LINEAR_STAGE_ORDER.indexOf('AUTHORIZATION')
  return i >= authIdx
}
