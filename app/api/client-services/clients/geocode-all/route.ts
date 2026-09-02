import { NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { auditClientAction, canAccessDepartment } from '@/lib/crm/access'
import { refreshMapGeocodes } from '@/lib/crm/therapistClientMap/geocodeClients'

export const maxDuration = 300

/**
 * POST /api/client-services/clients/geocode-all
 * Refresh map pins: invalidate bad coordinates, then geocode clients + therapists.
 */
export async function POST() {
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
    const result = await refreshMapGeocodes()

    await auditClientAction({
      userId: user.id,
      action: `MAP_GEOCODE_REFRESH:clients=${result.clients.geocoded}:therapists=${result.therapists.geocoded}:invalidated=${result.clients.invalidated + result.therapists.invalidated}`,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[map-geocode-refresh]', error)
    return NextResponse.json({ error: 'Map geocode refresh failed' }, { status: 500 })
  }
}
