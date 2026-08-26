import type { RequirementStatus } from '@prisma/client'
import { DOCUMENT_BY_KEY } from '@/lib/crm/documents'
import { requirementStatusSatisfies } from '@/lib/crm/stages'

/**
 * Parent-facing upload checklist used by the Intake & Documents nudge emails.
 * Order matches the Welcome Packet / intake email priority list.
 */
export const PARENT_UPLOAD_DOC_KEYS = [
  'insurance_card',
  'diagnostic_eval',
  'physician_referral',
  'iep_ifsp',
  'prior_aba',
  'intake_form',
  'consent_form',
] as const

/** Friendlier labels for email (override canonical CRM labels where helpful). */
const EMAIL_DOC_LABELS: Record<string, string> = {
  insurance_card: 'Insurance card — front and back (and Medicaid card, if applicable)',
  diagnostic_eval: 'Diagnostic evaluation report (DSM-5 / autism diagnosis)',
  physician_referral: 'Physician referral or prescription for ABA',
  iep_ifsp: 'IEP or IFSP, if applicable',
  prior_aba: 'Prior ABA records / transfer letter, if applicable',
  intake_form: 'Completed Client Intake Form (Form 01)',
  consent_form: 'Signed Consent & Authorization Form (Form 02)',
  parent_id: 'Parent / guardian photo ID',
  family_packet: 'Family packet',
}

export type MissingDocRequirement = {
  key: string
  label: string
  status: RequirementStatus
  expiresAt?: Date | string | null
}

/**
 * Build {{missingDocsList}} from open client requirements.
 * Falls back to empty array when nothing matches (template uses default copy).
 */
export function buildMissingDocsList(
  requirements: MissingDocRequirement[],
  now: Date = new Date()
): string[] {
  const open = requirements.filter(
    (r) => !requirementStatusSatisfies(r.key, r.status, r.expiresAt, now)
  )
  if (!open.length) return []

  const byKey = new Map(open.map((r) => [r.key, r]))
  const ordered: string[] = []
  const seen = new Set<string>()

  for (const key of PARENT_UPLOAD_DOC_KEYS) {
    const row = byKey.get(key)
    if (!row) continue
    seen.add(key)
    ordered.push(EMAIL_DOC_LABELS[key] ?? row.label ?? DOCUMENT_BY_KEY[key]?.label ?? key)
  }

  for (const row of open) {
    if (seen.has(row.key)) continue
    // Skip internal billing/clinical rows that families don't upload.
    if (row.key === 'eligibility_vob' || row.key === 'clinical_assessment') continue
    if (row.key === 'dsm5_checklist') continue
    ordered.push(EMAIL_DOC_LABELS[row.key] ?? row.label)
  }

  return ordered
}
