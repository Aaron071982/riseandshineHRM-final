import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCycleLabel } from '@/lib/billing/format'

export async function GET(request: NextRequest) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100)

  const cycles = await prisma.billingCycle.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      uploadedBy: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({ cycles })
}

export async function POST(request: NextRequest) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const body = await request.json()
  const periodStart = new Date(body.periodStart)
  const periodEnd = new Date(body.periodEnd)
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid period dates' }, { status: 400 })
  }

  const label =
    typeof body.label === 'string' && body.label.trim()
      ? body.label.trim()
      : formatCycleLabel(periodStart, periodEnd)

  const cycle = await prisma.billingCycle.create({
    data: {
      label,
      periodStart,
      periodEnd,
      uploadedById: auth.user.id,
      status: 'DRAFT',
      payableStatuses: ['completed', 'ready_to_bill'],
    },
  })

  return NextResponse.json({ cycle })
}
