import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { validateAssignmentTimes } from '@/lib/rbt-schedule/utils'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id } = await params
    if (id.startsWith('roster:')) {
      return NextResponse.json(
        { error: 'Weekly roster sessions must be edited in the Schedule tab' },
        { status: 400 }
      )
    }
    const existing = await prisma.rbtScheduleAssignment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: {
      clientName?: string
      dayOfWeek?: number
      startTime?: string
      endTime?: string
      location?: string | null
      notes?: string | null
      isActive?: boolean
    } = {}

    if (typeof body?.clientName === 'string') {
      const name = body.clientName.trim()
      if (!name) return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
      data.clientName = name
    }
    if (body?.dayOfWeek != null) {
      const day = Number(body.dayOfWeek)
      if (day < 0 || day > 6) return NextResponse.json({ error: 'Invalid day of week' }, { status: 400 })
      data.dayOfWeek = day
    }
    if (typeof body?.startTime === 'string') data.startTime = body.startTime.trim()
    if (typeof body?.endTime === 'string') data.endTime = body.endTime.trim()

    const startTime = data.startTime ?? existing.startTime
    const endTime = data.endTime ?? existing.endTime
    const timeError = validateAssignmentTimes(startTime, endTime)
    if (timeError) return NextResponse.json({ error: timeError }, { status: 400 })

    if (body?.location !== undefined) {
      data.location = typeof body.location === 'string' ? body.location.trim() || null : null
    }
    if (body?.notes !== undefined) {
      data.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    }
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive

    const assignment = await prisma.rbtScheduleAssignment.update({
      where: { id },
      data,
    })

    return NextResponse.json({ assignment })
  } catch (error) {
    console.error('[schedule-assignments PATCH]', error)
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id } = await params
    if (id.startsWith('roster:')) {
      return NextResponse.json(
        { error: 'Weekly roster sessions must be removed in the Schedule tab' },
        { status: 400 }
      )
    }
    const existing = await prisma.rbtScheduleAssignment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Soft-delete so history remains; calendar only shows isActive
    await prisma.rbtScheduleAssignment.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[schedule-assignments DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
  }
}
