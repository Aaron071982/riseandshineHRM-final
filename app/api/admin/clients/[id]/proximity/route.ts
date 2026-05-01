import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  runRbtProximitySearch,
  type RunRbtProximitySearchResult,
} from '@/lib/crm-client/proximitySearch'
import { activeCrmRbtAssignmentWhere } from '@/lib/crm-client/assignments'
import { RBTStatus } from '@prisma/client'
import { startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id: clientId } = await context.params

  try {
    const client = await prisma.crmClient.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        addressLine1: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
      },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const assignedRows = await prisma.clientRbtAssignment.findMany({
      where: { clientId, ...activeCrmRbtAssignmentWhere() },
      select: { rbtProfileId: true },
    })
    const excludeRbtProfileIds = [...new Set(assignedRows.map((r) => r.rbtProfileId))]

    const limit = Math.min(
      10,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') ?? '5', 10) || 5)
    )

    const result = await runRbtProximitySearch({
      clientAddress: client.addressLine1,
      clientCity: client.city,
      clientState: client.state,
      clientZip: client.zipCode,
      clientLatitude: client.latitude,
      clientLongitude: client.longitude,
      limit,
      rbtWhere: { status: RBTStatus.HIRED },
      excludeRbtProfileIds,
    })

    if ('error' in result && result.error) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      )
    }

    const ok = result as RunRbtProximitySearchResult
    const ids = ok.rbts.map((r) => r.rbtProfileId)
    const today = startOfDay(new Date())
    const grouped =
      ids.length === 0
        ? []
        : await prisma.clientRbtAssignment.groupBy({
            by: ['rbtProfileId'],
            where: {
              rbtProfileId: { in: ids },
              status: 'ACTIVE',
              OR: [{ endDate: null }, { endDate: { gte: today } }],
            },
            _count: { _all: true },
          })
    const countMap = new Map(grouped.map((g) => [g.rbtProfileId, g._count._all]))

    const rbts = ok.rbts.map((r) => ({
      ...r,
      activeClientCount: countMap.get(r.rbtProfileId) ?? 0,
    }))

    return NextResponse.json({
      rbts,
      excludedCount: ok.excludedCount,
      activeExcludedCount: ok.activeExcludedCount,
      clientLng: ok.clientLng,
      clientLat: ok.clientLat,
      message: ok.message,
    })
  } catch (e) {
    console.error('[GET client proximity]', e)
    return NextResponse.json({ error: 'Proximity search failed', details: String(e) }, { status: 500 })
  }
}
