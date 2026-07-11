import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canFinalizeCycle, getCycleBlockers } from '@/lib/billing/validateCycle'
import { recalculateCyclePayable } from '@/lib/billing/recalculatePayable'

/**
 * Finalize a billing cycle for Artemis review / payroll export.
 * Employee pay stubs now come from admin Payroll register uploads — this route
 * no longer generates rbt_pay_statements.
 */
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

  await recalculateCyclePayable(params.id)

  const updated = await prisma.billingCycle.update({
    where: { id: params.id },
    data: {
      status: 'FINALIZED',
      finalizedAt: new Date(),
      finalizedById: auth.user!.id,
    },
  })

  return NextResponse.json({ cycle: updated })
}
