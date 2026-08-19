import type { ReferralSignerRole } from '@prisma/client'

export const REFERRAL_SIGNER_LABELS: Record<ReferralSignerRole, string> = {
  PHYSICIAN: 'Physician',
  PSYCHOLOGIST: 'Psychologist',
  PSYCH_NP: 'Psychiatric NP',
  PEDS_NP: 'Pediatric NP',
}

export type ReferralValidityInput = {
  signedByRole: ReferralSignerRole | null
  hasAsdDx: boolean
  initialDxDate: Date | string | null
  severitySupportLevel: string | null
  abaRequiredStatement: boolean
  dsm5ChecklistAttached: boolean
}

export type ReferralValidityResult = {
  ok: boolean
  missing: string[]
}

export function evaluateReferralValidity(
  input: ReferralValidityInput | null | undefined
): ReferralValidityResult {
  if (!input) {
    return {
      ok: false,
      missing: [
        'signed_by_qualified_provider',
        'asd_diagnosis',
        'initial_dx_date',
        'severity_support_level',
        'aba_required_statement',
        'dsm5_checklist',
      ],
    }
  }

  const missing: string[] = []
  if (!input.signedByRole) missing.push('signed_by_qualified_provider')
  if (!input.hasAsdDx) missing.push('asd_diagnosis')
  if (!input.initialDxDate) missing.push('initial_dx_date')
  if (!input.severitySupportLevel?.trim()) missing.push('severity_support_level')
  if (!input.abaRequiredStatement) missing.push('aba_required_statement')
  if (!input.dsm5ChecklistAttached) missing.push('dsm5_checklist')

  return { ok: missing.length === 0, missing }
}

export const REFERRAL_FIELD_LABELS: Record<string, string> = {
  signed_by_qualified_provider:
    'Signed by physician / psychologist / psych-NP / peds-NP',
  asd_diagnosis: 'ASD diagnosis on referral',
  initial_dx_date: 'Initial diagnosis date',
  severity_support_level: 'Severity / support level',
  aba_required_statement: 'Statement that ABA is required',
  dsm5_checklist: 'DSM-5 checklist attached',
  physician_referral_validity: 'NY Medicaid referral is incomplete',
}
