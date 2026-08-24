import type { ClientStage, RequirementGroup, RequirementType } from '@prisma/client'

export type DocumentConditional = 'medicaid' | 'if_available' | 'if_applicable'

export type CanonicalDocument = {
  key: string
  label: string
  group: RequirementGroup
  /** Pipeline stage this row lives on (canAdvance filters by stage). */
  stage: ClientStage
  type: RequirementType
  /** Required to advance that stage, unless `conditional` applies. */
  requiredToAdvance: boolean
  conditional?: DocumentConditional
  /** Validity window in months from received/attested/signed. */
  validityMonths?: number
  /** Consent Form 02 cannot be satisfied by attestation alone. */
  attestAllowed: boolean
}

/**
 * Canonical family document set (Intake Form 01 / Consent 02 / Welcome Packet).
 * Shared docs are one key — never duplicate insurance or diagnostic eval.
 * Provider credentials (BCBA) do not belong here.
 */
export const CANONICAL_DOCUMENTS: readonly CanonicalDocument[] = [
  {
    key: 'family_packet',
    label: 'Family packet',
    group: 'INTAKE',
    stage: 'DOCUMENTS',
    type: 'DOCUMENT',
    requiredToAdvance: false,
    attestAllowed: true,
  },
  {
    key: 'intake_form',
    label: 'Intake form',
    group: 'INTAKE',
    stage: 'INTAKE',
    type: 'DOCUMENT',
    requiredToAdvance: false,
    attestAllowed: true,
  },
  {
    key: 'insurance_card',
    label: 'Insurance card (front+back)',
    group: 'INTAKE',
    stage: 'BENEFITS',
    type: 'DOCUMENT',
    requiredToAdvance: true,
    attestAllowed: true,
  },
  {
    key: 'parent_id',
    label: 'Parent/guardian photo ID',
    group: 'INTAKE',
    stage: 'DOCUMENTS',
    type: 'DOCUMENT',
    requiredToAdvance: false,
    attestAllowed: true,
  },
  {
    key: 'diagnostic_eval',
    label: 'Psychological evaluation',
    group: 'INTAKE',
    stage: 'AUTHORIZATION',
    type: 'DOCUMENT',
    requiredToAdvance: true,
    validityMonths: 36,
    attestAllowed: true,
  },
  {
    key: 'dsm5_checklist',
    label: 'DSM-5 checklist',
    group: 'INTAKE',
    stage: 'AUTHORIZATION',
    type: 'DOCUMENT',
    requiredToAdvance: true,
    attestAllowed: true,
  },
  {
    key: 'physician_referral',
    label: 'Doctor referral / prescription',
    group: 'INTAKE',
    stage: 'AUTHORIZATION',
    type: 'DOCUMENT',
    requiredToAdvance: true,
    validityMonths: 12,
    attestAllowed: true,
  },
  {
    key: 'iep_ifsp',
    label: 'IEP/IFSP',
    group: 'INTAKE',
    stage: 'DOCUMENTS',
    type: 'DOCUMENT',
    requiredToAdvance: false,
    conditional: 'if_applicable',
    attestAllowed: true,
  },
  {
    key: 'prior_aba',
    label: 'Transfer letter (if coming from another company)',
    group: 'INTAKE',
    stage: 'AUTHORIZATION',
    type: 'DOCUMENT',
    requiredToAdvance: false,
    conditional: 'if_applicable',
    attestAllowed: true,
  },
  {
    key: 'clinical_assessment',
    label: 'Assessment',
    group: 'CLINICAL',
    stage: 'AUTHORIZATION',
    type: 'DOCUMENT',
    requiredToAdvance: true,
    attestAllowed: true,
  },
  {
    key: 'eligibility_vob',
    label: 'Insurance eligibility (VOB)',
    group: 'BILLING',
    stage: 'AUTHORIZATION',
    type: 'DOCUMENT',
    requiredToAdvance: true,
    attestAllowed: true,
  },
  {
    key: 'consent_form',
    label: 'Parent consent form',
    group: 'INTAKE',
    stage: 'CONSENT',
    type: 'DOCUMENT',
    requiredToAdvance: true,
    validityMonths: 12,
    attestAllowed: false,
  },
] as const

export const CANONICAL_DOCUMENT_KEYS = CANONICAL_DOCUMENTS.map((d) => d.key)

export const DOCUMENT_BY_KEY: Record<string, CanonicalDocument> = Object.fromEntries(
  CANONICAL_DOCUMENTS.map((d) => [d.key, d])
)

/** Old live keys → canonical key. Never drop source rows — remap. */
export const LEGACY_DOCUMENT_KEY_MAP: Record<string, string> = {
  custody_guardian: 'intake_form',
  prior_aba_records: 'prior_aba',
  consent_form_signed: 'consent_form',
  medicaid_card: 'insurance_card',
  vineland: 'clinical_assessment',
  fast_assessment: 'clinical_assessment',
}

export const DOCUMENT_GROUP_ORDER: RequirementGroup[] = [
  'INTAKE',
  'CLINICAL',
  'BILLING',
]

export const DOCUMENT_GROUP_LABELS: Record<RequirementGroup, string> = {
  INTAKE: 'Intake',
  CLINICAL: 'Clinical',
  BILLING: 'Billing',
  CONSENT: 'Consent',
  STAGE: 'Stage checklist',
}

/** NY Medicaid + common NY MMC plans that still need a Medicaid-style referral. */
export function isMedicaidPayer(insuranceProvider: string | null | undefined): boolean {
  if (!insuranceProvider?.trim()) return false
  return /medicaid|fidelis|healthfirst|metroplus|uhc community|united\s*healthcare\s*community/i.test(
    insuranceProvider
  )
}

export function isDocumentRequired(
  doc: CanonicalDocument,
  insuranceProvider?: string | null
): boolean {
  if (!doc.requiredToAdvance) return false
  if (doc.conditional === 'medicaid') return isMedicaidPayer(insuranceProvider)
  if (doc.conditional === 'if_available' || doc.conditional === 'if_applicable') {
    return false
  }
  return true
}

export function computeExpiresAt(
  key: string,
  from: Date = new Date()
): Date | null {
  const months = DOCUMENT_BY_KEY[key]?.validityMonths
  if (!months) return null
  const d = new Date(from)
  d.setMonth(d.getMonth() + months)
  return d
}

export const STANDARD_DOCUMENT_REQUIREMENT_KEYS = CANONICAL_DOCUMENT_KEYS
