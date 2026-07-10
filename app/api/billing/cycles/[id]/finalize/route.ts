import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canFinalizeCycle, getCycleBlockers } from '@/lib/billing/validateCycle'
import { recalculateCyclePayable } from '@/lib/billing/recalculatePayable'
import { upsertPayStatementsForCycle } from '@/lib/billing/generatePayStatements'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const cycle = await prisma.billingCycle.findUnique({ where: { id: params.id } })
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }
  if (cycle.status === 'FINALIZED' || cycle.status === 'PAID') {
    return NextResponse.json({ error: 'Cycle is already finalized' }, { status: 400 })
  }

  const entries = await prisma.billingEntry.findMany({
    where: { billingCycleId: params.id },
  })

  const blockers = getCycleBlockers(entries)
  if (!canFinalizeCycle(entries)) {
    return NextResponse.json({ error: 'Cannot finalize cycle', blockers }, { status: 400 })
  }

  // Existing behavior: recalc entry hours/pay from payable statuses
  await recalculateCyclePayable(params.id)

  // Atomic: pay statements + FINALIZED status — never finalize without statements,
  // never leave statements for an unfinalized cycle.
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await upsertPayStatementsForCycle(params.id, tx)
      return tx.billingCycle.update({
        where: { id: params.id },
        data: {
          status: 'FINALIZED',
          finalizedAt: new Date(),
          finalizedById: auth.user!.id,
        },
      })
    })
    return NextResponse.json({ cycle: updated })
  } catch (error) {
    console.error('[billing/finalize] pay statement generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate employee pay statements. Cycle was not finalized.' },
      { status: 500 }
    )
  }
}
