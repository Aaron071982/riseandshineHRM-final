import { UserRole } from '@prisma/client'

/** Always has access to every admin portal module — never droppable via env overrides. */
export const PLATFORM_OWNER_EMAIL = 'aaronsiam21@gmail.com'

/** Super-admin emails (full platform access). Override via SUPER_ADMIN_EMAILS (comma-separated). */
const DEFAULT_SUPER_ADMIN_EMAILS = [PLATFORM_OWNER_EMAIL, 'kazi@siyam.nyc'] as const

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

/** Supabase storage bucket for resume uploads (private). */
export const RESUMES_STORAGE_BUCKET = 'resumes'

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
