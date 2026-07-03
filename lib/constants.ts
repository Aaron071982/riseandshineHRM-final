import { UserRole } from '@prisma/client'

/** Super-admin emails (full platform access). Override via SUPER_ADMIN_EMAILS (comma-separated). */
const DEFAULT_SUPER_ADMIN_EMAILS = ['aaronsiam21@gmail.com', 'kazi@siyam.nyc'] as const

export function getSuperAdminEmails(): string[] {
  const fromEnv = process.env.SUPER_ADMIN_EMAILS?.trim()
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  }
  return [...DEFAULT_SUPER_ADMIN_EMAILS]
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getSuperAdminEmails().includes(email.toLowerCase())
}

/** Fixed OTP for test accounts — only honored in non-production / localhost (see verify-otp). */
export const OTP_TEST_ACCOUNT_CODE = '000000'

const OTP_TEST_ACCOUNT_EMAILS = ['hrmtesting@gmail.com', 'aaronsiam22@gmail.com', 'aaronsiam24@gmail.com'] as const

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
