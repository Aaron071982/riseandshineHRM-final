import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SCHEDULABLE_RBT_WHERE } from '@/lib/rbt/schedulable'

/**
 * GET /api/admin/scheduling-beta/geocode-stats
 * Returns { totalHired, withCoords } for RBT Location Data section
 * (counts all schedulable RBTs — every status except FIRED / REJECTED).
 */
export async function GET() {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const [totalHired, withCoords] = await Promise.all([
      prisma.rBTProfile.count({ where: SCHEDULABLE_RBT_WHERE }),
      prisma.rBTProfile.count({
        where: {
          ...SCHEDULABLE_RBT_WHERE,
          latitude: { not: null },
          longitude: { not: null },
        },
      }),
    ])

    return NextResponse.json({ totalHired, withCoords })
  } catch (e) {
    console.error('[geocode-stats]', e)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
