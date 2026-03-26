import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id } = await params
    const existing = await prisma.timeEntry.findUnique({
      where: { id },
      select: { id: true, clockInTime: true, clockOutTime: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }
    if (existing.clockOutTime) {
      return NextResponse.json({ error: 'Entry is already clocked out' }, { status: 400 })
    }

    const now = new Date()
    const totalHours = Math.round((((now.getTime() - existing.clockInTime.getTime()) / 3600000) * 100)) / 100
    await prisma.timeEntry.update({
      where: { id },
      data: {
        clockOutTime: now,
        totalHours,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/admin/attendance/entries/[id]/clock-out failed:', error)
    return NextResponse.json({ error: 'Failed to clock out entry' }, { status: 500 })
  }
}
