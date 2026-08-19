export const CONSENT_BILLING_LINE_KEYS = ['cpt_97151', 'cpt_97153'] as const

export const CONSENT_LINE_DEFS = [
  { key: 'cpt_97151', label: '97151 — ABA assessment', section: 'ABA Assessment & Treatment' },
  { key: 'cpt_97153', label: '97153 — Direct therapy (1:1)', section: 'ABA Assessment & Treatment' },
  { key: 'cpt_97155', label: '97155 — Protocol modification / supervision', section: 'ABA Assessment & Treatment' },
  { key: 'cpt_97156', label: '97156 — Family guidance', section: 'ABA Assessment & Treatment' },
  { key: 'cpt_97154_97158', label: '97154 / 97158 — Group', section: 'ABA Assessment & Treatment' },
  { key: 'service_location', label: 'Service location', section: 'Services' },
  { key: 'telehealth', label: 'Telehealth', section: 'Services' },
  { key: 'recording_photography', label: 'Recording / photography (clinical)', section: 'Recording' },
  { key: 'recording_marketing', label: 'Recording / photography (marketing)', section: 'Recording' },
  { key: 'disclosure_insurance', label: 'Disclosure — insurance / payer', section: 'Disclosures' },
  { key: 'disclosure_school', label: 'Disclosure — school', section: 'Disclosures' },
  { key: 'disclosure_other_providers', label: 'Disclosure — other providers', section: 'Disclosures' },
  { key: 'comm_email', label: 'Communication — email', section: 'Preferences' },
  { key: 'comm_phone', label: 'Communication — phone', section: 'Preferences' },
  { key: 'comm_sms', label: 'Communication — SMS', section: 'Preferences' },
  { key: 'emergency_treatment', label: 'Emergency treatment', section: 'Safety' },
  { key: 'e_signature', label: 'E-signature / UETA acknowledgment', section: 'Signature' },
] as const

export type ConsentLineKey = (typeof CONSENT_LINE_DEFS)[number]['key']

export type ConsentLineState = {
  initialed: boolean
  initialedAt: string | null
  initialedBy: string | null
}

export type ConsentLinesMap = Partial<Record<ConsentLineKey, ConsentLineState>>

export function emptyConsentLine(): ConsentLineState {
  return { initialed: false, initialedAt: null, initialedBy: null }
}

export function emptyConsentLines(): ConsentLinesMap {
  const out: ConsentLinesMap = {}
  for (const def of CONSENT_LINE_DEFS) {
    out[def.key] = emptyConsentLine()
  }
  return out
}

export function parseConsentLines(raw: unknown): ConsentLinesMap {
  const base = emptyConsentLines()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  for (const def of CONSENT_LINE_DEFS) {
    const row = obj[def.key]
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    base[def.key] = {
      initialed: r.initialed === true,
      initialedAt: typeof r.initialedAt === 'string' ? r.initialedAt : null,
      initialedBy: typeof r.initialedBy === 'string' ? r.initialedBy : null,
    }
  }
  return base
}

export function isConsentLineInitialed(
  lines: ConsentLinesMap,
  key: ConsentLineKey
): boolean {
  return lines[key]?.initialed === true
}

/** Hard billing gate: assessment + direct therapy initials. */
export function computeConsentBillingReady(lines: ConsentLinesMap): boolean {
  return CONSENT_BILLING_LINE_KEYS.every((k) => isConsentLineInitialed(lines, k))
}

export function consentExpiresAt(signatureDate: Date): Date {
  const d = new Date(signatureDate)
  d.setFullYear(d.getFullYear() + 1)
  return d
}
