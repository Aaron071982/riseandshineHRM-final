import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { assertRateLimit } from '@/lib/otp-rate-limit'

const WINDOW_MS = 15 * 60 * 1000

const LIMITS = {
  validate: 80,
  schedule: 30,
  calendar: 40,
} as const

export type SchedulingPublicAction = keyof typeof LIMITS

/** DB-backed rate limit for public interview-scheduling token routes. */
export async function assertSchedulingPublicRateLimit(
  request: NextRequest,
  action: SchedulingPublicAction
): Promise<NextResponse | null> {
  const ip = getClientIpFromRequest(request) ?? 'unknown'
  const key = `public:scheduling:${action}:${ip}`
  return assertRateLimit(
    key,
    LIMITS[action],
    WINDOW_MS,
    'Too many requests. Please try again later.'
  )
}
