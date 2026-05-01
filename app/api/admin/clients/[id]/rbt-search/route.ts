import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { activeCrmRbtAssignmentWhere } from '@/lib/crm-client/assignments'
import { RBTStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id: clientId } = await context.params
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()

  if (q.length < 2) {
    return NextResponse.json({ rbts: [] })
  }

  try {
    const assignedRows = await prisma.clientRbtAssignment.findMany({
      where: { clientId, ...activeCrmRbtAssignmentWhere() },
      select: { rbtProfileId: true },
    })
    const excludeIds = assignedRows.map((r) => r.rbtProfileId)

    const rbts = await prisma.rBTProfile.findMany({
      where: {
        status: RBTStatus.HIRED,
        id: excludeIds.length ? { notIn: excludeIds } : undefined,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        transportation: true,
        languagesJson: true,
        latitude: true,
        longitude: true,
        availabilitySlots: { select: { dayOfWeek: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    return NextResponse.json({ rbts })
  } catch (e) {
    console.error('[rbt-search]', e)
    return NextResponse.json({ error: 'Search failed', details: String(e) }, { status: 500 })
  }
}
