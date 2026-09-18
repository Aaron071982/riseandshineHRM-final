import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { loadRbtPortalPaySummary } from '@/lib/payroll/rbtPortalStubs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const summary = await loadRbtPortalPaySummary(rbtProfileId)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[rbt/pay/summary]', error)
    return NextResponse.json({ error: 'Failed to load pay summary' }, { status: 500 })
  }
}
