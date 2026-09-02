import { NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { auditClientAction, canAccessDepartment } from '@/lib/crm/access'
import { geocodeServiceClientsMissingCoords } from '@/lib/crm/therapistClientMap/geocodeClients'

export const maxDuration = 300

/**
 * POST /api/client-services/clients/geocode-all
 * Batch-geocode LIVE service clients with addresses but no cached lat/lng.
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
    const result = await geocodeServiceClientsMissingCoords()

    await auditClientAction({
      userId: user.id,
      action: `CLIENT_GEOCODE_ALL:geocoded=${result.geocoded}:failed=${result.failed}`,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[client-geocode-all]', error)
    return NextResponse.json({ error: 'Client geocode batch failed' }, { status: 500 })
  }
}
