import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession, isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  const updated = await prisma.billingCycle.update({
    where: { id: params.id },
    data: {
      status: 'REVIEW',
      finalizedAt: null,
      finalizedById: null,
    },
  })

  return NextResponse.json({ cycle: updated })
}
