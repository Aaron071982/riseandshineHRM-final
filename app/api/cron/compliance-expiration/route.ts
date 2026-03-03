import { NextRequest, NextResponse } from 'next/server'
import { runExpirationEngine } from '@/lib/compliance/expiration'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

