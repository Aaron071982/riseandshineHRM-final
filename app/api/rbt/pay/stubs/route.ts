import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { loadRbtPortalStubs } from '@/lib/payroll/rbtPortalStubs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stubs = await loadRbtPortalStubs(rbtProfileId)
    return NextResponse.json({ stubs })
  } catch (error) {
    console.error('[rbt/pay/stubs]', error)
    return NextResponse.json({ error: 'Failed to load pay stubs' }, { status: 500 })
  }
}
