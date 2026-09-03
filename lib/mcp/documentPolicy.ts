/**
 * Fail-closed document-type policy for MCP document tools.
 *
 * text  — clinical/admin; contents may be returned to the model
 * link  — identity/financial; signed viewing URL only, never OCR/text
 * blocked — unknown/unclassified; nothing
 */

export type DocumentReadableVia = 'text' | 'link' | 'blocked'

const TEXT_KEYS = new Set([
  'diagnostic_eval',
  'dsm5_checklist',
  'clinical_assessment',
  'physician_referral',
  'iep_ifsp',
  'vineland',
  'fast_assessment',
  'intake_form',
  'family_packet',
  'eligibility_vob',
  'prior_aba',
  'prior_aba_records',
  'consent_form',
  'consent_form_signed',
  'custody_guardian',
  'treatment_plan',
  'assessment_report',
  'demographics',
])

const LINK_ONLY_KEYS = new Set([
  'parent_id',
  'insurance_card',
  'medicaid_card',
  'photo_id',
  'government_id',
  'drivers_license',
  'passport',
])

const TEXT_LABEL_HINTS = [
  /psych(ological)?\s*eval/i,
  /dsm[- ]?5/i,
  /treatment\s*plan/i,
  /assessment/i,
  /iep|ifsp/i,
  /referral|prescription/i,
  /vineland/i,
  /\bfast\b/i,
  /intake/i,
  /demographic/i,
  /eligib|vob|benefit/i,
  /consent/i,
]

const LINK_LABEL_HINTS = [
  /photo\s*id/i,
  /parent.*id|guardian.*id/i,
  /insurance\s*card/i,
  /medicaid\s*card/i,
  /driver.?s?\s*licen/i,
  /passport/i,
  /government\s*id/i,
]

export function classifyDocumentReadableVia(input: {
  key?: string | null
  label?: string | null
  documentType?: string | null
}): DocumentReadableVia {
  const key = (input.key ?? input.documentType ?? '').trim().toLowerCase()
  if (key && LINK_ONLY_KEYS.has(key)) return 'link'
  if (key && TEXT_KEYS.has(key)) return 'text'

  const label = (input.label ?? '').trim()
  if (label) {
    if (LINK_LABEL_HINTS.some((re) => re.test(label))) return 'link'
    if (TEXT_LABEL_HINTS.some((re) => re.test(label))) return 'text'
  }

  return 'blocked'
}

export function documentTypeRefusalMessage(readableVia: DocumentReadableVia): string {
  if (readableVia === 'link') {
    return 'This document type is not viewable as text via the connector (identity/financial). Use mode=link or open it in the app.'
  }
  return 'This document type is not classified for connector access. Open it in the app.'
}
