import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeEntryPay } from '@/lib/billing/matcher'
import { recomputeCycleTotals } from '@/lib/billing/totals'

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
  const entryIds: string[] = Array.isArray(body.entryIds)
    ? body.entryIds
    : body.entryId
      ? [body.entryId]
      : []

  if (entryIds.length === 0) {
    return NextResponse.json({ error: 'entryId or entryIds required' }, { status: 400 })
  }

  const rbtProfileId = typeof body.rbtProfileId === 'string' ? body.rbtProfileId : null
  const bulkHighConfidence = body.bulkHighConfidence === true
  const minConfidence = typeof body.minConfidence === 'number' ? body.minConfidence : 0.85

  const entries = await prisma.billingEntry.findMany({
    where: { billingCycleId: params.id, id: { in: entryIds } },
  })

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No entries found' }, { status: 404 })
  }

  const updated = []

  for (const entry of entries) {
    if (entry.isExcluded) continue

    if (bulkHighConfidence) {
      if (entry.matchStatus !== 'NEEDS_REVIEW' || entry.matchConfidence < minConfidence) continue
      if (!entry.suggestedRbtProfileId) continue
    }

    const targetRbtId = bulkHighConfidence ? entry.suggestedRbtProfileId! : rbtProfileId
    if (!targetRbtId) {
      return NextResponse.json({ error: 'rbtProfileId required' }, { status: 400 })
    }

    const rbt = await prisma.rBTProfile.findUnique({
      where: { id: targetRbtId },
      select: {
        id: true,
        hourlyPayRate: true,
        firstName: true,
        lastName: true,
      },
    })
    if (!rbt) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    const hourlyRate = body.hourlyRate != null ? Number(body.hourlyRate) : rbt.hourlyPayRate
    const { grossPay, finalPay } = computeEntryPay(entry.totalHours, hourlyRate, entry.adjustment)

    const updatedEntry = await prisma.billingEntry.update({
      where: { id: entry.id },
      data: {
        rbtProfileId: rbt.id,
        payrollOnlyId: null,
        matchStatus: 'MATCHED',
        matchConfidence: 1,
        suggestedRbtProfileId: null,
        hourlyRate,
        grossPay,
        finalPay,
      },
      include: { rbtProfile: { select: { firstName: true, lastName: true } } },
    })

    await prisma.rBTProfile.update({
      where: { id: rbt.id },
      data: { artemisProviderName: entry.providerNameRaw },
    })

    updated.push(updatedEntry)
  }

  await recomputeCycleTotals(params.id)

  return NextResponse.json({ updated, count: updated.length })
}
