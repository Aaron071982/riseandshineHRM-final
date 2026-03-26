import { NextRequest, NextResponse } from 'next/server'

/**
 * Cron route auth: Bearer token or `?secret=` must match CRON_SECRET when set.
 * In production, CRON_SECRET must be configured (otherwise endpoints return 503).
 * In non-production, missing CRON_SECRET allows local testing without a secret.
 */
export function assertCronOrResponse(request: NextRequest): NextResponse | null {
  const CRON_SECRET = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const secretParam = request.nextUrl.searchParams.get('secret')
  const providedSecret = secretParam ?? authHeader?.replace(/^Bearer\s+/i, '') ?? ''

  const isProd = process.env.NODE_ENV === 'production'

  if (isProd) {
    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
    }
    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null
  }

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
