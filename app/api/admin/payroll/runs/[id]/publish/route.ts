import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const force = Boolean(body.force)

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: { entries: true },
  })
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (run.status === 'PUBLISHED') {
    return NextResponse.json({ error: 'Already published' }, { status: 400 })
  }

  const unpaidUnmatched = run.entries.filter(
    (e) => e.matchStatus !== 'MATCHED' || !e.rbtProfileId
  )
  const withPay = unpaidUnmatched.filter((e) => e.netPay > 0 || e.grossPay > 0)

  if (withPay.length > 0 && !force) {
    return NextResponse.json(
      {
        error: 'Unmatched employees with pay remain',
        unmatchedWithPay: withPay.map((e) => ({
          id: e.id,
          payrollName: e.payrollName,
          netPay: e.netPay,
        })),
        canForce: true,
      },
      { status: 400 }
    )
  }

  // Persist remembered names for all matched entries
  await prisma.$transaction(async (tx) => {
    for (const e of run.entries) {
      if (e.rbtProfileId && e.matchStatus === 'MATCHED') {
        await tx.rBTProfile.update({
          where: { id: e.rbtProfileId },
          data: { payrollName: e.payrollName },
        })
      }
    }
    await tx.payrollRun.update({
      where: { id: params.id },
      data: { status: 'PUBLISHED' },
    })
  })

  const updated = await prisma.payrollRun.findUnique({ where: { id: params.id } })
  return NextResponse.json({ run: updated })
}
