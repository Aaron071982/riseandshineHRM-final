import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRbtSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Returns schedule assignments for the logged-in RBT only.
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

    const assignments = await prisma.rbtScheduleAssignment.findMany({
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
    })

    // Defense in depth: never return another RBT's rows
    const scoped = assignments.filter((a) => a.rbtProfileId === rbtProfileId)

    return NextResponse.json({ assignments: scoped })
  } catch (error) {
    console.error('[rbt/schedule GET]', error)
    return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 })
  }
}
