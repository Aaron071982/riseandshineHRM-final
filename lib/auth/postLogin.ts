import type { SessionUserRole } from '@/lib/auth'

/** Prisma UserRole values plus optional legacy/custom strings we accept at login. */
export type LoginRole = SessionUserRole | 'PAYROLL'

/**
 * Roles that may log in without the hired-RBT CANDIDATE gate.
 * PAYROLL is not in Prisma UserRole yet; included here for forward-compatible DB values.
 */
export const DIRECT_LOGIN_ROLES: readonly string[] = [
  'ADMIN',
  'BILLING',
  'PAYROLL',
  'TRAINER',
  'BCBA',
  'MARKETING',
  'CALL_CENTER',
  'DEV',
  'RBT',
]

const DIRECT_LOGIN_SET = new Set(DIRECT_LOGIN_ROLES)

/** True when OTP verify should skip the un-hired CANDIDATE rejection path. */
export function isDirectLoginRole(role: string | null | undefined): boolean {
  const r = (role ?? '').toUpperCase()
  return DIRECT_LOGIN_SET.has(r)
}

/** Normalize role returned to the client after successful OTP. */
export function normalizeLoginRole(role: string | null | undefined): string {
  return (role ?? '').toUpperCase()
}

/** Post-login redirect for verify-otp page and home page. */
export function getPostLoginPath(role: string | null | undefined): string | null {
  switch (normalizeLoginRole(role)) {
    case 'ADMIN':
      return '/admin/dashboard'
    case 'BILLING':
    case 'PAYROLL':
      return '/billing/dashboard'
    case 'RBT':
      return '/rbt/dashboard'
    case 'TRAINER':
      return '/training/dashboard'
    case 'BCBA':
    case 'MARKETING':
    case 'CALL_CENTER':
    case 'DEV':
      // No dedicated portal yet; session is valid — land on admin employees (admin users only).
      // Non-admin staff with these roles should be rare; billing/trainer use their portals above.
      return '/admin/employees'
    default:
      return null
  }
}

export function roleAllowedInOtpResponse(role: string | null | undefined): boolean {
  const r = normalizeLoginRole(role)
  if (isDirectLoginRole(r)) return true
  if (r === 'CANDIDATE') return true
  return false
}
