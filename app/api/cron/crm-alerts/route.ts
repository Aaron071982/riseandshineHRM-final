import { NextRequest, NextResponse } from 'next/server'
import { assertCrmCronOrResponse } from '@/lib/cron-auth'
import { runAlertScan } from '@/lib/crm/alerts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * CRM alert generation cron.
 * Auth: Authorization: Bearer <CRON_SECRET> (required).
 */
export async function GET(request: NextRequest) {
  const denied = assertCrmCronOrResponse(request)
  if (denied) return denied

  try {
    const stats = await runAlertScan()
    return NextResponse.json({
      success: true,
      ...stats,
    })
  } catch (err) {
    console.error('[crm-alerts] scan failed', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
