/*
 * SETUP REQUIRED:
 * 1. Set CRON_SECRET in Vercel Dashboard:
 *    Project → Settings → Environment Variables
 *    → Add: CRON_SECRET = [any random string]
 * 2. Vercel automatically signs cron requests
 *    with this secret — no other config needed
 * 3. Do NOT set this in GitHub secrets anymore
 *    as GitHub Actions crons are now disabled
 */
import { NextRequest, NextResponse } from 'next/server'
import { runExpirationEngine } from '@/lib/compliance/expiration'
import { assertCronOrResponse } from '@/lib/cron-auth'

export async function GET(request: NextRequest) {
  const auth = assertCronOrResponse(request)
  if (auth) return auth

  try {
    await runExpirationEngine()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[cron:compliance-expiration] failed', error)
    return NextResponse.json(
      { error: 'Failed to run expiration engine', details: error?.message },
      { status: 500 },
    )
  }
}

