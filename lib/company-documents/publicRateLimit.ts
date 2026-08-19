import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { assertRateLimit } from '@/lib/otp-rate-limit'

const WINDOW_MS = 15 * 60 * 1000

/** Per-IP limits for unauthenticated company-doc magic-link endpoints. */
const LIMITS = {
  meta: 60,
  file: 40,
  view: 40,
  sign: 20,
} as const

export type CompanyDocPublicAction = keyof typeof LIMITS

/** DB-backed brute-force protection for public company-doc token routes. */
export async function assertCompanyDocPublicRateLimit(
  request: NextRequest,
  action: CompanyDocPublicAction
): Promise<NextResponse | null> {
  const ip = getClientIpFromRequest(request) ?? 'unknown'
  const key = `public:company-doc:${action}:${ip}`
  return assertRateLimit(
    key,
    LIMITS[action],
    WINDOW_MS,
    'Too many requests. Please try again later.'
  )
}
