import { UserRole } from '@prisma/client'

/** Always has access to every admin portal module — never droppable via env overrides. */
export const PLATFORM_OWNER_EMAIL = 'aaronsiam21@gmail.com'

/** Super-admin emails (full platform access). Override via SUPER_ADMIN_EMAILS (comma-separated). */
const DEFAULT_SUPER_ADMIN_EMAILS = [
  PLATFORM_OWNER_EMAIL,
  // HRM-wide access is intentionally restricted.
  'irsal@riseandshineaba.com',
  'tisha@riseandshineaba.com',
] as const

function normalizeEmailList(emails: readonly string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
}

/** Env list (if set) ∪ defaults for the given key emails — owner is always included. */
function resolveEmailAllowlist(
  envValue: string | undefined,
  defaults: readonly string[]
): string[] {
  const fromEnv = envValue
    ?.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const base = fromEnv && fromEnv.length > 0 ? fromEnv : [...defaults]
  return normalizeEmailList([...base, PLATFORM_OWNER_EMAIL, ...DEFAULT_SUPER_ADMIN_EMAILS])
}

export function getSuperAdminEmails(): string[] {
  return resolveEmailAllowlist(process.env.SUPER_ADMIN_EMAILS, DEFAULT_SUPER_ADMIN_EMAILS)
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getSuperAdminEmails().includes(email.trim().toLowerCase())
}

/**
 * Only these emails may access Billing and Payroll (nav + APIs + layouts).
 * Role alone is not enough. Override via BILLING_MANAGER_EMAILS (comma-separated).
 */
const DEFAULT_BILLING_MANAGER_EMAILS = [
  // Aaron
  'aaronsiam21@gmail.com',
  // Kazi / Jamal
  'kazi@siyam.nyc',
  'kazi@riseandshineaba.com',
  'kazi@riseandshine.nyc',
  'kazi@jamal.nyc',
  // Fardeen
  'fardeenhassansardar12@gmail.com',
  'fardeen@riseandshineaba.com',
  'fardeen@riseandshine.nyc',
  // Shazia
  'shaziakhaliq37@gmail.com',
] as const

export function getBillingManagerEmails(): string[] {
  return resolveEmailAllowlist(process.env.BILLING_MANAGER_EMAILS, DEFAULT_BILLING_MANAGER_EMAILS)
}

export function isBillingManagerEmail(email: string | null | undefined): boolean {
  if (!email) return false
  if (isLimitedAdminEmail(email)) return false
  return getBillingManagerEmails().includes(email.trim().toLowerCase())
}

/**
 * Executive admin portal (indigo themed nav/dashboard).
 * Aaron keeps the standard orange admin view.
 */
const DEFAULT_EXECUTIVE_ADMIN_EMAILS = [
  'kazi@jamal.nyc',
  'kazi@riseandshineaba.com',
] as const

export function getExecutiveAdminEmails(): string[] {
  // Executive theme is Kazi-only — do NOT force-include platform owner (Aaron stays orange).
  const fromEnv = process.env.EXECUTIVE_ADMIN_EMAILS?.trim()
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  }
  return [...DEFAULT_EXECUTIVE_ADMIN_EMAILS]
}

export function isExecutiveAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getExecutiveAdminEmails().includes(email.trim().toLowerCase())
}

/** Full admin portal login — never billing-only portal (super-admin + executive admin). */
export function isFullAdminLoginEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return isSuperAdminEmail(email) || isExecutiveAdminEmail(email)
}

/**
 * HR admins who should NOT see Billing, Payroll, Operations, or Documents.
 * They still get full ADMIN access to everything else (schedule, employees, etc.).
 */
const DEFAULT_LIMITED_ADMIN_EMAILS = [
  'afsana@riseandshineaba.com',
  'tisha@riseandshineaba.com',
] as const

export function getLimitedAdminEmails(): string[] {
  const fromEnv = process.env.LIMITED_ADMIN_EMAILS?.trim()
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  }
  return [...DEFAULT_LIMITED_ADMIN_EMAILS]
}

export function isLimitedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getLimitedAdminEmails().includes(email.trim().toLowerCase())
}

/** Documents tab/APIs — all ADMIN except limited admins. Super-admins always allowed. */
export function canAccessDocumentsEmail(email: string | null | undefined): boolean {
  if (!email) return false
  if (isSuperAdminEmail(email)) return true
  if (isLimitedAdminEmail(email)) return false
  return true
}

/** Company-document TEST distribution goes only to this RBT account. */
export const COMPANY_DOC_TEST_EMAIL = 'aaronsiam22@gmail.com'

export function isCompanyDocTestEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === COMPANY_DOC_TEST_EMAIL
}

/** Fixed OTP for local/bypass envs only — never for aaronsiam22 (uses real emailed OTP). */
export const OTP_TEST_ACCOUNT_CODE = '000000'

const OTP_TEST_ACCOUNT_EMAILS = ['hrmtesting@gmail.com', 'aaronsiam24@gmail.com'] as const

export function isOtpTestAccount(email: string | null | undefined): boolean {
  if (!email) return false
  return (OTP_TEST_ACCOUNT_EMAILS as readonly string[]).includes(email.toLowerCase())
}

export function getOtpTestCode(): string {
  return OTP_TEST_ACCOUNT_CODE
}

/** Supabase storage bucket for signed onboarding PDFs (private). */
export const STORAGE_BUCKET = 'onboarding-documents'

/** Supabase storage bucket for org-wide training materials (private). */
export const TRAINING_MATERIALS_BUCKET = 'training-materials'

/** Supabase storage bucket for resume uploads (private). */
export const RESUMES_STORAGE_BUCKET = 'resumes'

/**
 * CRM parent-email attachments (PHI) — private bucket path prefix inside STORAGE_BUCKET.
 * Files live at: crm-email-attachments/{clientId}/{uuid}-{safeName}
 */
export const CRM_EMAIL_ATTACHMENTS_PREFIX = 'crm-email-attachments'

/**
 * CRM client requirement documents (PHI) — private bucket path prefix inside STORAGE_BUCKET.
 */
export const CRM_CLIENT_REQUIREMENTS_PREFIX = 'crm-client-documents'

/**
 * CRM PA authorization templates (PHI) — private bucket path prefix inside STORAGE_BUCKET.
 */
export const CRM_CLIENT_AUTH_TEMPLATES_PREFIX = 'crm-auth-templates'

/**
 * CRM locked clinical assessment artifacts (PHI) — private bucket path prefix.
 */
export const CRM_CLINICAL_ASSESSMENTS_PREFIX = 'crm-clinical-assessments'

/** Private Supabase bucket for treatment assessment files (PHI). */
export const ASSESSMENT_FILES_BUCKET = 'assessment-files'

/**
 * Treatment assessment uploads (PHI) — path inside ASSESSMENT_FILES_BUCKET:
 * clients/{serviceClientId}/assessments/{assessmentId}/{sectionKey}/{uuid}-{filename}
 */
export const ASSESSMENT_FILES_PREFIX = 'clients'

export { UserRole }

export const USER_ROLE = {
  ADMIN: 'ADMIN' as UserRole,
  RBT: 'RBT' as UserRole,
  CANDIDATE: 'CANDIDATE' as UserRole,
  BCBA: 'BCBA' as UserRole,
  BILLING: 'BILLING' as UserRole,
  MARKETING: 'MARKETING' as UserRole,
  CALL_CENTER: 'CALL_CENTER' as UserRole,
  DEV: 'DEV' as UserRole,
  TRAINER: 'TRAINER' as UserRole,
} as const
