import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      entries: {
        include: {
          rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { payrollName: 'asc' },
      },
    },
  })

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const candidates = await prisma.rBTProfile.findMany({
    where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return NextResponse.json({
    run,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
    })),
  })
}

/** Rename payroll run label */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const label = String(body.label ?? '').trim()
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }
  if (label.length > 200) {
    return NextResponse.json({ error: 'label is too long' }, { status: 400 })
  }

  try {
    const run = await prisma.payrollRun.update({
      where: { id: params.id },
      data: { label },
      select: {
        id: true,
        label: true,
        payDate: true,
        employeeCount: true,
        totalNetPay: true,
        totalGrossPay: true,
        status: true,
        sourceFileName: true,
      },
    })
    return NextResponse.json({ run })
  } catch {
    return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
  }
}

/** Delete a payroll run (and its entries via cascade) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  try {
    await prisma.payrollRun.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
  }
}
