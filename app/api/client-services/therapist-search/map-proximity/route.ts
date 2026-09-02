import { NextRequest, NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  auditClientAction,
  canAccessDepartment,
  CrmAccessError,
} from '@/lib/crm/access'
import { findNearestTherapistsForMapClient } from '@/lib/crm/therapistClientMap/mapProximity'

export const maxDuration = 60

/**
 * POST /api/client-services/therapist-search/map-proximity
 * Nearest available hired therapists for a selected orange client.
 */
export async function POST(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  if (!canAccessDepartment(user, 'STAFFING')) {
    return NextResponse.json(
      { error: 'Staffing access required' },
      { status: 403 }
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      clientId?: string
    }
    const clientId = body.clientId?.trim()
    if (!clientId) {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 })
    }

    const result = await findNearestTherapistsForMapClient(user, clientId)
    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'THERAPIST_CLIENT_MAP_PROXIMITY',
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CrmAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    console.error('[map-proximity]', error)
    return NextResponse.json(
      { error: 'Proximity search failed' },
      { status: 500 }
    )
  }
}
