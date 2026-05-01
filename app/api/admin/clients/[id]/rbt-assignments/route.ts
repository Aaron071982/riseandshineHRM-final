import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { activeCrmRbtAssignmentWhere } from '@/lib/crm-client/assignments'
import { RBTStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id: clientId } = await context.params

  try {
    const body = await request.json().catch(() => ({}))
    const rbtProfileId = typeof body.rbtProfileId === 'string' ? body.rbtProfileId.trim() : ''
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'rbtProfileId is required' }, { status: 400 })
    }

    const client = await prisma.crmClient.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const rbt = await prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { id: true, status: true },
    })
    if (!rbt || rbt.status !== RBTStatus.HIRED) {
      return NextResponse.json({ error: 'RBT must be HIRED' }, { status: 400 })
    }

    const duplicate = await prisma.clientRbtAssignment.findFirst({
      where: {
        clientId,
        rbtProfileId,
        ...activeCrmRbtAssignmentWhere(),
      },
    })
    if (duplicate) {
      return NextResponse.json({ error: 'RBT already assigned to this client' }, { status: 400 })
    }

    const preActiveCount = await prisma.clientRbtAssignment.count({
      where: { clientId, ...activeCrmRbtAssignmentWhere() },
    })

    const isPrimary = Boolean(body.isPrimary)
    const daysRaw = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : []
    const daysOfWeek = daysRaw
      .map((d: unknown) => String(d).toUpperCase())
      .filter((d: string): d is (typeof DOW)[number] => (DOW as readonly string[]).includes(d))

    const startDate = body.startDate ? new Date(body.startDate) : new Date()

    if (isPrimary) {
      await prisma.clientRbtAssignment.updateMany({
        where: { clientId, ...activeCrmRbtAssignmentWhere(), isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const assignment = await prisma.clientRbtAssignment.create({
      data: {
        clientId,
        rbtProfileId,
        assignedByUserId: auth.user.id,
        isPrimary,
        startDate,
        endDate: null,
        daysOfWeek,
        timeStart: typeof body.timeStart === 'string' ? body.timeStart : null,
        timeEnd: typeof body.timeEnd === 'string' ? body.timeEnd : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        status: 'ACTIVE',
      },
    })

    const suggestPromoteToActive =
      preActiveCount === 0 && client.status === 'WAITING'

    return NextResponse.json({
      assignment,
      suggestPromoteToActive,
    })
  } catch (e) {
    console.error('[POST rbt-assignments]', e)
    return NextResponse.json(
      { error: 'Failed to create assignment', details: String(e) },
      { status: 500 }
    )
  }
}
