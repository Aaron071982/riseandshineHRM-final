import { NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { auditClientAction, canAccessDepartment } from '@/lib/crm/access'
import { loadTherapistClientMapData } from '@/lib/crm/therapistClientMap/loadMapData'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-services/therapist-search/map-data
 * Step 1 data layer: mapped therapists/clients with server-computed marker colors.
 */
export async function GET() {
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
    const data = await loadTherapistClientMapData(user)

    await auditClientAction({
      userId: user.id,
      action: 'THERAPIST_CLIENT_MAP_DATA',
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[therapist-client-map-data]', error)
    return NextResponse.json(
      { error: 'Failed to load map data' },
      { status: 500 }
    )
  }
}
