import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Confirm / change match for a payroll entry; remembers payrollName on the profile. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const entryId = String(body.entryId ?? '')
  const rbtProfileId = body.rbtProfileId == null ? null : String(body.rbtProfileId)

  if (!entryId) {
    return NextResponse.json({ error: 'entryId is required' }, { status: 400 })
  }

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } })
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status === 'PUBLISHED') {
    return NextResponse.json({ error: 'Cannot change matches on a published run' }, { status: 400 })
  }

  const entry = await prisma.payrollRunEntry.findFirst({
    where: { id: entryId, payrollRunId: params.id },
  })
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

  if (rbtProfileId) {
    const conflict = await prisma.payrollRunEntry.findFirst({
      where: {
        payrollRunId: params.id,
        rbtProfileId,
        id: { not: entryId },
      },
    })
    if (conflict) {
      return NextResponse.json(
        { error: 'That employee is already matched to another row in this run' },
        { status: 400 }
      )
    }

    const [updated] = await prisma.$transaction([
      prisma.payrollRunEntry.update({
        where: { id: entryId },
        data: {
          rbtProfileId,
          matchStatus: 'MATCHED',
          matchConfidence: 1,
        },
        include: {
          rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.rBTProfile.update({
        where: { id: rbtProfileId },
        data: { payrollName: entry.payrollName },
      }),
    ])

    return NextResponse.json({ entry: updated })
  }

  const updated = await prisma.payrollRunEntry.update({
    where: { id: entryId },
    data: {
      rbtProfileId: null,
      matchStatus: 'UNMATCHED',
      matchConfidence: 0,
    },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  return NextResponse.json({ entry: updated })
}
