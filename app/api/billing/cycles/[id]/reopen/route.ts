import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession, isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recalculateCyclePayable } from '@/lib/billing/recalculatePayable'
import { deletePayStatementsForCycle } from '@/lib/billing/generatePayStatements'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  if (!isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const cycle = await prisma.billingCycle.findUnique({ where: { id: params.id } })
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Remove employee-visible snapshots before marking unfinalized
      await deletePayStatementsForCycle(params.id, tx)
      return tx.billingCycle.update({
        where: { id: params.id },
        data: {
          status: 'REVIEW',
          finalizedAt: null,
          finalizedById: null,
        },
      })
    })

    await recalculateCyclePayable(params.id)

    return NextResponse.json({ cycle: updated })
  } catch (error) {
    console.error('[billing/reopen]', error)
    return NextResponse.json({ error: 'Failed to reopen cycle' }, { status: 500 })
  }
}
