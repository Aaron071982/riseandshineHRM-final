import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/scheduling-beta/geocode-stats
 * Returns { totalHired, withCoords } for RBT Location Data section.
 */
export async function GET() {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const [totalHired, withCoords] = await Promise.all([
      prisma.rBTProfile.count({ where: { status: 'HIRED' } }),
      prisma.rBTProfile.count({
        where: { status: 'HIRED', latitude: { not: null }, longitude: { not: null } },
      }),
    ])

    return NextResponse.json({ totalHired, withCoords })
  } catch (e) {
    console.error('[geocode-stats]', e)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
