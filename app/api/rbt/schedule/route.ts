import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRbtSession } from '@/lib/auth'
import type { ScheduleAssignmentDTO } from '@/lib/rbt-schedule/utils'

export const dynamic = 'force-dynamic'

/**
 * Returns schedule assignments for the logged-in RBT only.
 * Ownership is enforced via session.rbtProfileId — never accept an RBT id from the client.
 * Ownership is enforced via session.rbtProfileId — never accept an RBT id from the client.
 */
export async function GET() {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId!
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const profile = await prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        user: { select: { email: true } },
      },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const latest = await prisma.scheduleImportBatch.findFirst({
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
    })

    const nativeRows = await prisma.rbtScheduleAssignment.findMany({
      where: {
        rbtProfileId,
        isActive: true,
        deletedAt: null,
        reviewStatus: { in: ['NONE', 'CONFIRMED'] },
        ...(latest
          ? {
              OR: [
                { periodStart: latest.periodStart, periodEnd: latest.periodEnd },
                { source: 'MANUAL', periodStart: null, periodEnd: null },
              ],
            }
          : {}),
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        rbtProfileId: true,
        clientName: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        location: true,
        notes: true,
        isActive: true,
      },
    })

    const native: ScheduleAssignmentDTO[] = nativeRows.filter(
      (a) => a.rbtProfileId === rbtProfileId
    )

    return NextResponse.json({ assignments: native })
  } catch (error) {
    console.error('[rbt/schedule GET]', error)
    return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 })
  }
}
