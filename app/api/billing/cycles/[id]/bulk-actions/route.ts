import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { excludeEntry } from '@/lib/billing/entryActions'
import { recomputeCycleTotals } from '@/lib/billing/totals'
import { matchEntryToRbt } from '@/lib/billing/entryActions'

const NON_RBT_ROLES = new Set(['BCBA', 'BCBA Supervisor', 'Supervisor', 'Admin', 'Billing'])

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const cycle = await prisma.billingCycle.findUnique({ where: { id: params.id } })
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }
  if (cycle.status === 'FINALIZED' || cycle.status === 'PAID') {
    return NextResponse.json({ error: 'Cycle is locked' }, { status: 400 })
  }

  const body = await request.json()
  const actorEmail = auth.user.email ?? auth.user.id

  if (body.action === 'exclude_non_rbt') {
    const entries = await prisma.billingEntry.findMany({
      where: { billingCycleId: params.id, isExcluded: false },
    })
    let count = 0
    for (const e of entries) {
      const role = (e.role ?? '').trim()
      if (role && NON_RBT_ROLES.has(role)) {
        await excludeEntry(e.id, `Non-RBT role: ${role}`)
        count++
      }
    }
    await recomputeCycleTotals(params.id)
    return NextResponse.json({ count })
  }

  if (body.action === 'confirm_high_confidence') {
    const minConfidence = typeof body.minConfidence === 'number' ? body.minConfidence : 0.85
    const entries = await prisma.billingEntry.findMany({
      where: {
        billingCycleId: params.id,
        isExcluded: false,
        matchStatus: 'NEEDS_REVIEW',
        matchConfidence: { gte: minConfidence },
        suggestedRbtProfileId: { not: null },
      },
    })
    let count = 0
    for (const e of entries) {
      if (e.suggestedRbtProfileId) {
        await matchEntryToRbt(e.id, e.suggestedRbtProfileId, actorEmail)
        count++
      }
    }
    await recomputeCycleTotals(params.id)
    return NextResponse.json({ count })
  }

  /**
   * Accept appointed-hours as-is and clear session review flags that block finalize
   * (date mismatch / no overlap / missing appointment times). Hours are unchanged.
   */
  if (body.action === 'clear_session_review_flags') {
    const entries = await prisma.billingEntry.findMany({
      where: { billingCycleId: params.id, isExcluded: false },
      select: { id: true },
    })
    const entryIds = entries.map((e) => e.id)
    if (entryIds.length === 0) {
      return NextResponse.json({ cleared: 0 })
    }
    const result = await prisma.billingSession.updateMany({
      where: {
        billingEntryId: { in: entryIds },
        reviewFlag: { not: null },
      },
      data: { reviewFlag: null },
    })
    return NextResponse.json({ cleared: result.count })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
