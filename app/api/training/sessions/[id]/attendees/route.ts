import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response
  const { id } = await context.params

  const bookings = await prisma.trainingBooking.findMany({
    where: { trainingSessionId: id },
    include: {
      rbtProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          createdAt: true,
        },
      },
      markedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { bookedAt: 'asc' },
  })

  return NextResponse.json({ bookings })
}
