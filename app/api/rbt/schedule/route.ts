import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRbtSession } from '@/lib/auth'
import { mergeAssignments, rosterAssignmentsForRbt } from '@/lib/rbt-schedule/from-roster'
import type { ScheduleAssignmentDTO } from '@/lib/rbt-schedule/utils'

export const dynamic = 'force-dynamic'

/**
 * Returns schedule assignments for the logged-in RBT only.
 * Ownership is enforced via session.rbtProfileId — never accept an RBT id from the client.
 * Also overlays weekly-roster session slots matched by therapist name/email.
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

    const [nativeRows, roster] = await Promise.all([
      prisma.rbtScheduleAssignment.findMany({
        where: { rbtProfileId, isActive: true },
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
      }),
      rosterAssignmentsForRbt({
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        userEmail: profile.user?.email,
      }),
    ])

    // Defense in depth: never return another RBT's rows
    const native: ScheduleAssignmentDTO[] = nativeRows.filter((a) => a.rbtProfileId === rbtProfileId)
    const assignments = mergeAssignments(native, roster)

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('[rbt/schedule GET]', error)
    return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 })
  }
}
