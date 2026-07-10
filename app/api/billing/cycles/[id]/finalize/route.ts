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
  // Re-finalize after reopen is allowed when status is REVIEW (or DRAFT/etc.) —
  // only block if already FINALIZED/PAID. There is no shortcut that skips statements.
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

  // Full flow every time: recalc → generate statements → set FINALIZED (same transaction for last two)
  console.log(
    `[billing/finalize] start cycleId=${params.id} priorStatus=${cycle.status} entryCount=${entries.length}`
  )
  await recalculateCyclePayable(params.id)

  try {
    const { updated, statementCount, eligible, skipped } = await prisma.$transaction(
      async (tx) => {
        const result = await upsertPayStatementsForCycle(params.id, tx)
        console.log(
          `[billing/finalize] statements ready count=${result.statementCount} eligible=${result.eligible} — setting FINALIZED`
        )
        const updatedCycle = await tx.billingCycle.update({
          where: { id: params.id },
          data: {
            status: 'FINALIZED',
            finalizedAt: new Date(),
            finalizedById: auth.user!.id,
          },
        })
        return { updated: updatedCycle, ...result }
      },
      { timeout: 120_000, maxWait: 20_000 }
    )

    console.log(
      `[billing/finalize] success cycleId=${params.id} statementCount=${statementCount} eligible=${eligible} skipped=${skipped}`
    )

    return NextResponse.json({
      cycle: updated,
      payStatements: { statementCount, eligible, skipped },
    })
  } catch (error) {
    console.error('[billing/finalize] pay statement generation failed — cycle NOT finalized:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate employee pay statements. Cycle was not finalized.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
