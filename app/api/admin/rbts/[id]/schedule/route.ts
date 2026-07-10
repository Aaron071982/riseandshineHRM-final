import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { validateAssignmentTimes } from '@/lib/rbt-schedule/utils'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  const profile = await prisma.rBTProfile.findUnique({ where: { id }, select: { id: true } })
  if (!profile) {
    return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
  }

  const assignments = await prisma.rbtScheduleAssignment.findMany({
    where: { rbtProfileId: id, isActive: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })

  return NextResponse.json({ assignments })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user!

    const { id } = await params
    const profile = await prisma.rBTProfile.findUnique({ where: { id }, select: { id: true } })
    if (!profile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    const body = await request.json()
    const clientName = typeof body?.clientName === 'string' ? body.clientName.trim() : ''
    if (!clientName) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
    }

    const startTime = typeof body?.startTime === 'string' ? body.startTime.trim() : ''
    const endTime = typeof body?.endTime === 'string' ? body.endTime.trim() : ''
    const timeError = validateAssignmentTimes(startTime, endTime)
    if (timeError) {
      return NextResponse.json({ error: timeError }, { status: 400 })
    }

    const daysRaw: unknown[] = Array.isArray(body?.daysOfWeek)
      ? body.daysOfWeek
      : body?.dayOfWeek != null
        ? [body.dayOfWeek]
        : []
    const days: number[] = []
    for (const raw of daysRaw) {
      const d = Number(raw)
      if (Number.isInteger(d) && d >= 0 && d <= 6 && !days.includes(d)) days.push(d)
    }
    if (days.length === 0) {
      return NextResponse.json({ error: 'Select at least one day of the week' }, { status: 400 })
    }

    const location = typeof body?.location === 'string' ? body.location.trim() || null : null
    const notes = typeof body?.notes === 'string' ? body.notes.trim() || null : null

    const created = await prisma.$transaction(
      days.map((dayOfWeek) =>
        prisma.rbtScheduleAssignment.create({
          data: {
            rbtProfileId: id,
            clientName,
            dayOfWeek,
            startTime,
            endTime,
            location,
            notes,
            createdBy: user.id,
          },
        })
      )
    )

    return NextResponse.json({ assignments: created }, { status: 201 })
  } catch (error) {
    console.error('[admin/schedule POST]', error)
    return NextResponse.json({ error: 'Failed to create schedule assignment' }, { status: 500 })
  }
}
