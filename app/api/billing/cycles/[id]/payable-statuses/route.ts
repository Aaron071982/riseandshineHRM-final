import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recalculateCyclePayable } from '@/lib/billing/recalculatePayable'
import {
  parsePayableStatusesJson,
  PAYABLE_STATUS_OPTIONS,
  type ArtemisSessionStatusKey,
} from '@/lib/billing/sessionStatus'

export async function PATCH(
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

  const body = await request.json().catch(() => ({}))
  const allowed = new Set(PAYABLE_STATUS_OPTIONS.map((o) => o.key))
  const raw = Array.isArray(body.payableStatuses) ? body.payableStatuses : []
  const payableStatuses = raw
    .map((v: unknown) => String(v).trim().toLowerCase())
    .filter((v: string): v is ArtemisSessionStatusKey => allowed.has(v as ArtemisSessionStatusKey))

  if (payableStatuses.length === 0) {
    return NextResponse.json({ error: 'Select at least one payable status' }, { status: 400 })
  }

  await recalculateCyclePayable(params.id, payableStatuses)

  const updated = await prisma.billingCycle.findUnique({
    where: { id: params.id },
    include: {
      entries: {
        where: { isExcluded: false },
        include: {
          rbtProfile: { select: { firstName: true, lastName: true } },
          payrollOnly: { select: { fullName: true } },
          sessions: { select: { sessionStatus: true, actualMinutes: true, dos: true, clientName: true } },
        },
      },
    },
  })

  return NextResponse.json({
    cycle: updated,
    payableStatuses: parsePayableStatusesJson(updated?.payableStatuses),
  })
}
