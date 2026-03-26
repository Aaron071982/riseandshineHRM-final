import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const userId = auth.user.id

  const prismaAny = prisma as unknown as {
    interviewerSettings?: { findUnique: (args: any) => Promise<any> }
    interviewerAvailability?: { findMany: (args: any) => Promise<any[]> }
  }

  let settings: any = null
  try {
    if (prismaAny.interviewerSettings?.findUnique) {
      settings = await prismaAny.interviewerSettings.findUnique({
        where: { userId },
      })
    }
  } catch (error) {
    console.error('GET /api/admin/availability/my: failed to load settings', error)
  }

  let availability: any[] = []
  try {
    if (prismaAny.interviewerAvailability?.findMany) {
      availability = await prismaAny.interviewerAvailability.findMany({
        where: { userId, isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }, { startMinute: 'asc' }],
      })
    }
  } catch (error) {
    console.error('GET /api/admin/availability/my: failed to load availability', error)
  }

  // Build weekly structure: 0-6 (Sun-Sat), each day has array of { startHour, startMinute, endHour, endMinute }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const availabilityByDay: Array<{
    dayOfWeek: number
    dayName: string
    enabled: boolean
    ranges: Array<{ startHour: number; startMinute: number; endHour: number; endMinute: number }>
  }> = []

  for (let d = 0; d <= 6; d++) {
    const rows = availability.filter((a) => a.dayOfWeek === d)
    availabilityByDay.push({
      dayOfWeek: d,
      dayName: dayNames[d],
      enabled: rows.length > 0,
      ranges:
        rows.length > 0
          ? rows.map((r) => ({
              startHour: r.startHour,
              startMinute: r.startMinute,
              endHour: r.endHour,
              endMinute: r.endMinute,
            }))
          : [{ startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 }],
    })
  }

  return NextResponse.json({
    acceptInterviewBookings: settings?.acceptInterviewBookings ?? true,
    slotDurationMinutes: settings?.slotDurationMinutes ?? 15,
    bufferMinutes: settings?.bufferMinutes ?? 0,
    availability: availabilityByDay,
  })
}
