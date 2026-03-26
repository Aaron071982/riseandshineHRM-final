import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Range = { startHour: number; startMinute: number; endHour: number; endMinute: number }
type DayAvailability = { dayOfWeek: number; enabled: boolean; ranges: Range[] }

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const userId = auth.user.id

  let body: {
    acceptInterviewBookings?: boolean
    slotDurationMinutes?: number
    bufferMinutes?: number
    availability?: DayAvailability[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const acceptInterviewBookings = body.acceptInterviewBookings ?? true
  const slotDurationMinutes = Math.min(60, Math.max(15, body.slotDurationMinutes ?? 15))
  const bufferMinutes = [0, 15, 30].includes(Number(body.bufferMinutes)) ? Number(body.bufferMinutes) : 0
  const availability = Array.isArray(body.availability) ? body.availability : []

  await prisma.$transaction(async (tx) => {
    await tx.interviewerSettings.upsert({
      where: { userId },
      create: {
        userId,
        acceptInterviewBookings,
        slotDurationMinutes,
        bufferMinutes,
      },
      update: {
        acceptInterviewBookings,
        slotDurationMinutes,
        bufferMinutes,
        updatedAt: new Date(),
      },
    })

    await tx.interviewerAvailability.deleteMany({ where: { userId } })

    for (const day of availability) {
      if (!day.enabled || !Array.isArray(day.ranges) || day.ranges.length === 0) continue
      const dayOfWeek = Number(day.dayOfWeek)
      if (dayOfWeek < 0 || dayOfWeek > 6) continue
      for (const r of day.ranges) {
        const startHour = Number(r.startHour)
        const startMinute = Number(r.startMinute) === 30 ? 30 : 0
        const endHour = Number(r.endHour)
        const endMinute = Number(r.endMinute) === 30 ? 30 : 0
        if (startHour > endHour || (startHour === endHour && startMinute >= endMinute)) continue
        await tx.interviewerAvailability.create({
          data: {
            userId,
            dayOfWeek,
            startHour,
            startMinute,
            endHour,
            endMinute,
            isActive: true,
          },
        })
      }
    }
  })

  return NextResponse.json({ success: true })
}
