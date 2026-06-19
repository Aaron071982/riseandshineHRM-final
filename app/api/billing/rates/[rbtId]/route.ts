import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { rbtId: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const rbt = await prisma.rBTProfile.findUnique({ where: { id: params.rbtId } })
  if (!rbt) {
    return NextResponse.json({ error: 'RBT not found' }, { status: 404 })
  }

  const body = await request.json()
  const data: {
    hourlyPayRate?: number | null
    artemisProviderName?: string | null
    payRateUpdatedAt?: Date
    payRateUpdatedBy?: string
  } = {}

  if (body.hourlyPayRate !== undefined) {
    data.hourlyPayRate =
      body.hourlyPayRate === null || body.hourlyPayRate === '' ? null : Number(body.hourlyPayRate)
    data.payRateUpdatedAt = new Date()
    data.payRateUpdatedBy = auth.user.email ?? auth.user.id
  }

  if (body.artemisProviderName !== undefined) {
    data.artemisProviderName = body.artemisProviderName?.trim() || null
    if (!data.payRateUpdatedAt) {
      data.payRateUpdatedAt = new Date()
      data.payRateUpdatedBy = auth.user.email ?? auth.user.id
    }
  }

  const updated = await prisma.rBTProfile.update({
    where: { id: params.rbtId },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hourlyPayRate: true,
      artemisProviderName: true,
      payRateUpdatedAt: true,
      payRateUpdatedBy: true,
    },
  })

  return NextResponse.json({ rbt: updated })
}
