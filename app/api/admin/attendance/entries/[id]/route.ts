import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const nextClockIn = body.clockInTime ? new Date(body.clockInTime as string) : null
    const nextClockOut = body.clockOutTime ? new Date(body.clockOutTime as string) : null

    if (!nextClockIn || Number.isNaN(nextClockIn.getTime())) {
      return NextResponse.json({ error: 'Valid clockInTime is required' }, { status: 400 })
    }
    if (nextClockOut && Number.isNaN(nextClockOut.getTime())) {
      return NextResponse.json({ error: 'Invalid clockOutTime' }, { status: 400 })
    }
    if (nextClockOut && nextClockOut <= nextClockIn) {
      return NextResponse.json({ error: 'clockOutTime must be after clockInTime' }, { status: 400 })
    }

    const totalHours = nextClockOut ? Math.round((((nextClockOut.getTime() - nextClockIn.getTime()) / 3600000) * 100)) / 100 : null

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        clockInTime: nextClockIn,
        clockOutTime: nextClockOut,
        totalHours,
      },
      select: { id: true },
    })

    return NextResponse.json({ success: true, entry: updated })
  } catch (error) {
    console.error('PATCH /api/admin/attendance/entries/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id } = await params
    await prisma.timeEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/admin/attendance/entries/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
  }
}
