import { prisma } from '@/lib/prisma'

export type ActiveBookingRow = {
  rbtProfileId: string
  attendanceStatus: string
  sessionEndTime: Date
  sessionStatus: string
}

/** Active future bookings for many RBTs (one query). */
export async function getActiveBookingsByRbtIds(rbtProfileIds: string[]): Promise<Map<string, ActiveBookingRow>> {
  if (rbtProfileIds.length === 0) return new Map()

  const now = new Date()
  const bookings = await prisma.trainingBooking.findMany({
    where: {
      rbtProfileId: { in: rbtProfileIds },
      attendanceStatus: 'BOOKED',
      trainingSession: {
        endTime: { gt: now },
        status: { not: 'CANCELLED' },
      },
    },
    select: {
      rbtProfileId: true,
      attendanceStatus: true,
      trainingSession: { select: { endTime: true, status: true } },
    },
  })

  const map = new Map<string, ActiveBookingRow>()
  for (const b of bookings) {
    map.set(b.rbtProfileId, {
      rbtProfileId: b.rbtProfileId,
      attendanceStatus: b.attendanceStatus,
      sessionEndTime: b.trainingSession.endTime,
      sessionStatus: b.trainingSession.status,
    })
  }
  return map
}
