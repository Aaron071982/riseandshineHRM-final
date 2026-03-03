import { NextRequest, NextResponse } from 'next/server'
import { runSupervisionComplianceEngine } from '@/lib/compliance/supervision'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

