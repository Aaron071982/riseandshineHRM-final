import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import {
  markActivelyWorkingManual,
  removeActiveStatusManual,
} from '@/lib/rbt/activeWorking'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const { id: rbtProfileId } = await params
    const body = await request.json().catch(() => ({}))
    const action = body?.action as string | undefined
    const reason = typeof body?.reason === 'string' ? body.reason : undefined
    const keepActiveReview = body?.keepActiveReview === true

    const actor = user?.email ?? user?.name ?? 'Admin'

    if (action === 'mark') {
      await markActivelyWorkingManual(rbtProfileId, actor, reason, { keepActiveReview })
      return NextResponse.json({ success: true, postHireStage: 'ACTIVE_DELIVERY' })
    }

    if (action === 'remove') {
      if (!reason?.trim()) {
        return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
      }
      await removeActiveStatusManual(rbtProfileId, actor, reason)
      return NextResponse.json({ success: true, postHireStage: 'MATCHING' })
    }

    return NextResponse.json({ error: 'action must be mark or remove' }, { status: 400 })
  } catch (error) {
    console.error('[active-working]', error)
    const msg = error instanceof Error ? error.message : 'Failed to update active working status'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
