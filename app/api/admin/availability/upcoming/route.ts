import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const now = new Date()

  let interviews: Array<{
    id: string
    scheduledAt: Date
    durationMinutes: number
    meetingUrl: string | null
    rbtProfile: { id: string; firstName: string; lastName: string } | null
  }> = []

  try {
    interviews = await prisma.interview.findMany({
      where: {
        claimedByUserId: auth.user.id,
        status: 'SCHEDULED',
        scheduledAt: { gte: now },
      },
      include: {
        rbtProfile: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    }) as any
  } catch (error) {
    console.error('GET /api/admin/availability/upcoming: failed to load', error)
  }

  return NextResponse.json(
    interviews.map((i) => ({
      id: i.id,
      scheduledAt: i.scheduledAt.toISOString(),
      durationMinutes: i.durationMinutes,
      meetingUrl: i.meetingUrl,
      rbtProfile: i.rbtProfile
        ? {
            id: i.rbtProfile.id,
            firstName: i.rbtProfile.firstName,
            lastName: i.rbtProfile.lastName,
          }
        : null,
    }))
  )
}
