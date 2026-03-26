import { NextRequest, NextResponse } from 'next/server'
import { runSupervisionComplianceEngine } from '@/lib/compliance/supervision'
import { assertCronOrResponse } from '@/lib/cron-auth'

export async function GET(request: NextRequest) {
  const auth = assertCronOrResponse(request)
  if (auth) return auth

  try {
    await runSupervisionComplianceEngine()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[cron:supervision-checks] failed', error)
    return NextResponse.json(
      { error: 'Failed to run supervision engine', details: error?.message },
      { status: 500 },
    )
  }
}

