import { PLATFORM_OWNER_EMAIL } from '@/lib/constants'

/** Cookie for elevated Client Services PHI session (separate from main HRM session). */
export const CS_SESSION_COOKIE = 'cs_session'

/** Elevated session TTL — 30 minutes. */
export const CS_SESSION_DURATION_MS = 30 * 60 * 1000

/**
 * Client Services access — exact email allowlist, plus name substrings.
 * Override via CLIENT_SERVICES_FULL_ACCESS_EMAILS (comma-separated);
 * platform owner is always included.
 */
const DEFAULT_CLIENT_SERVICES_EMAILS = [
  PLATFORM_OWNER_EMAIL,
  'kazi@siyam.nyc',
  'kazi@jamal.nyc',
  'kazi@riseandshineaba.com',
  // Fardeen (common misspelling fadeen also accepted)
  'fardeen@riseandshineaba.com',
  'fadeen@riseandshineaba.com',
  'shazia@riseandshineaba.com',
  'afsana@riseandshineaba.com',
] as const

/** Any email containing these substrings also gets Client Services access. */
const CLIENT_SERVICES_EMAIL_SUBSTRINGS = ['jaden', 'azm'] as const

export function getClientServicesFullAccessEmails(): string[] {
  const fromEnv = process.env.CLIENT_SERVICES_FULL_ACCESS_EMAILS?.trim()
  const base = fromEnv
    ? fromEnv
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_CLIENT_SERVICES_EMAILS.map((e) => e.toLowerCase())
  return [...new Set([...base, PLATFORM_OWNER_EMAIL.toLowerCase()])]
}

/** Exact allowlist, or email local/domain part containing jaden / azm. */
export function isClientServicesFullAccessEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (getClientServicesFullAccessEmails().includes(normalized)) return true
  return CLIENT_SERVICES_EMAIL_SUBSTRINGS.some((s) => normalized.includes(s))
}

/** Prefix on otp_codes.email so elevate OTPs never collide with login OTPs. */
export function clientServicesOtpEmailKey(email: string): string {
  return `cs-elevate:${email.trim().toLowerCase()}`
}

export const SERVICE_CLIENT_DOCUMENT_TYPES = [
  'INSURANCE_CARD',
  'MEDICAID_CARD',
  'DIAGNOSTIC_EVAL',
  'PHYSICIAN_REFERRAL',
  'IEP_IFSP',
  'CUSTODY_GUARDIAN',
  'PRIOR_ABA_RECORDS',
  'CONSENT_FORM',
  'MEET_AND_GREET_FORM',
] as const

export type ServiceClientDocumentTypeKey = (typeof SERVICE_CLIENT_DOCUMENT_TYPES)[number]

export const SERVICE_CLIENT_DOCUMENT_LABELS: Record<ServiceClientDocumentTypeKey, string> = {
  INSURANCE_CARD: 'Insurance Card',
  MEDICAID_CARD: 'Medicaid Card',
  DIAGNOSTIC_EVAL: 'Diagnostic Eval',
  PHYSICIAN_REFERRAL: 'Physician Referral',
  IEP_IFSP: 'IEP/IFSP',
  CUSTODY_GUARDIAN: 'Custody/Guardian',
  PRIOR_ABA_RECORDS: 'Prior ABA Records',
  CONSENT_FORM: 'Consent Form',
  MEET_AND_GREET_FORM: 'Meet & Greet Form',
}

/** CSV column header → document type */
export const CSV_DOCUMENT_COLUMNS: { header: string; type: ServiceClientDocumentTypeKey }[] = [
  { header: 'Insurance Card', type: 'INSURANCE_CARD' },
  { header: 'Medicaid Card', type: 'MEDICAID_CARD' },
  { header: 'Diagnostic Eval', type: 'DIAGNOSTIC_EVAL' },
  { header: 'Physician Referral', type: 'PHYSICIAN_REFERRAL' },
  { header: 'IEP/IFSP', type: 'IEP_IFSP' },
  { header: 'Custody/Guardian', type: 'CUSTODY_GUARDIAN' },
  { header: 'Prior ABA Records', type: 'PRIOR_ABA_RECORDS' },
  { header: 'Consent Form', type: 'CONSENT_FORM' },
  { header: 'Meet & Greet Form', type: 'MEET_AND_GREET_FORM' },
]

export const NY_BOROUGHS = [
  'Bronx',
  'Brooklyn',
  'Queens',
  'Manhattan',
  'Staten Island',
] as const
