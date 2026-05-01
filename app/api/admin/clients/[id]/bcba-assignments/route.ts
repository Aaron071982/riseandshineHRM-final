import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { activeCrmBcbaAssignmentWhere } from '@/lib/crm-client/assignments'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id: clientId } = await context.params

  try {
    const body = await request.json().catch(() => ({}))
    const bcbaProfileId = typeof body.bcbaProfileId === 'string' ? body.bcbaProfileId.trim() : ''
    if (!bcbaProfileId) {
      return NextResponse.json({ error: 'bcbaProfileId is required' }, { status: 400 })
    }

    const client = await prisma.crmClient.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const bcba = await prisma.bCBAProfile.findUnique({ where: { id: bcbaProfileId } })
    if (!bcba) {
      return NextResponse.json({ error: 'BCBA not found' }, { status: 404 })
    }

    const dup = await prisma.clientBcbaAssignment.findFirst({
      where: {
        clientId,
        bcbaProfileId,
        ...activeCrmBcbaAssignmentWhere(),
      },
    })
    if (dup) {
      return NextResponse.json({ error: 'BCBA already assigned' }, { status: 400 })
    }

    const isPrimary = body.isPrimary !== false

    if (isPrimary) {
      await prisma.clientBcbaAssignment.updateMany({
        where: { clientId, ...activeCrmBcbaAssignmentWhere(), isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const assignment = await prisma.clientBcbaAssignment.create({
      data: {
        clientId,
        bcbaProfileId,
        assignedByUserId: auth.user.id,
        isPrimary,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        status: 'ACTIVE',
      },
    })

    return NextResponse.json({ assignment })
  } catch (e) {
    console.error('[POST bcba-assignments]', e)
    return NextResponse.json(
      { error: 'Failed to create BCBA assignment', details: String(e) },
      { status: 500 }
    )
  }
}
