import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geocodeAddressWithFallbacks } from '@/lib/mapbox-geocode'

const DELAY_MS = 100

/**
 * POST /api/admin/rbts/geocode-all
 * Geocode all RBT profiles that have address but no lat/lng. Tries 4 address formats per RBT. Rate limited 100ms between calls.
 */
export async function POST() {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const profiles = await prisma.rBTProfile.findMany({
      where: {
        latitude: null,
        OR: [
          { addressLine1: { not: null, notIn: [''] } },
          { locationCity: { not: null, notIn: [''] } },
          { locationState: { not: null, notIn: [''] } },
          { zipCode: { not: null, notIn: [''] } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        addressLine1: true,
        locationCity: true,
        locationState: true,
        zipCode: true,
      },
      orderBy: { updatedAt: 'asc' },
    })

    let geocoded = 0
    let failed = 0
    const failedNames: string[] = []
    let attemptIndex = 0

    for (const p of profiles) {
      attemptIndex++
      const isFirstThree = attemptIndex <= 3
      const debugLog = isFirstThree
        ? (format: string, url: string, response: unknown, failureReason?: string) => {
            console.log('[geocode-all] attempt', attemptIndex, 'format', format, 'URL', url)
            console.log('[geocode-all] attempt', attemptIndex, 'response', JSON.stringify(response)?.slice(0, 500))
            if (failureReason) console.log('[geocode-all] attempt', attemptIndex, 'failure', failureReason)
          }
        : undefined

      const result = await geocodeAddressWithFallbacks(
        p.addressLine1 ?? undefined,
        p.locationCity ?? undefined,
        p.locationState ?? undefined,
        p.zipCode ?? undefined,
        debugLog
      )

      await new Promise((r) => setTimeout(r, DELAY_MS))

      if (result) {
        await prisma.rBTProfile.update({
          where: { id: p.id },
          data: { latitude: result.lat, longitude: result.lng },
        })
        geocoded++
        console.log('[geocode-all] geocoded', p.firstName, p.lastName, 'format:', result.formatUsed)
      } else {
        failed++
        failedNames.push(`${p.firstName} ${p.lastName}`)
        console.log('[geocode-all] failed', p.firstName, p.lastName, 'all formats failed or out of US bounds')
      }
    }

    return NextResponse.json({
      total: profiles.length,
      geocoded,
      failed,
      skipped: 0,
      failedNames: failedNames.length ? failedNames : undefined,
    })
  } catch (e) {
    console.error('[geocode-all]', e)
    return NextResponse.json({ error: 'Geocode all failed' }, { status: 500 })
  }
}
