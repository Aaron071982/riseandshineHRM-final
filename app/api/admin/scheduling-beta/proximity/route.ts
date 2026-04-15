import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geocodeAddress } from '@/lib/mapbox-geocode'
import { haversineMiles } from '@/lib/scheduling-beta/zipToCoord'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const STRAIGHT_LINE_MILES = 30
const HAVERSINE_TOP = 15
const DEFAULT_LIMIT = 6

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))
    const clientAddress = typeof body.clientAddress === 'string' ? body.clientAddress.trim() : ''
    const clientCity = typeof body.clientCity === 'string' ? body.clientCity.trim() : ''
    const clientState = typeof body.clientState === 'string' ? body.clientState.trim() : ''
    const clientZip = typeof body.clientZip === 'string' ? body.clientZip.trim() : ''
    const limit = Math.min(10, Math.max(1, Number(body.limit) || DEFAULT_LIMIT))

    const fullAddress = [clientAddress, clientCity, clientState, clientZip].filter(Boolean).join(', ').trim()
    if (!fullAddress) {
      return NextResponse.json(
        { error: 'Client address is required', code: 'MISSING_ADDRESS' },
        { status: 400 }
      )
    }

    const clientCoords = await geocodeAddress(clientAddress || null, clientCity || null, clientState || null, clientZip || null)
    if (!clientCoords) {
      return NextResponse.json(
        { error: 'Could not find this address. Please check and try again.', code: 'GEOCODE_FAILED' },
        { status: 422 }
      )
    }

    /** Include all pipeline stages except rejected candidates. */
    const notRejected = { status: { not: 'REJECTED' as const } }

    const [rbtsWithCoords, rbtsTotal] = await Promise.all([
      prisma.rBTProfile.findMany({
        where: {
          ...notRejected,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          addressLine1: true,
          addressLine2: true,
          locationCity: true,
          locationState: true,
          zipCode: true,
          latitude: true,
          longitude: true,
          transportation: true,
          languagesJson: true,
          availabilityJson: true,
          status: true,
          availabilitySlots: { select: { dayOfWeek: true } },
        },
      }),
      prisma.rBTProfile.count({ where: notRejected }),
    ])

    const activeExcludedRows = await prisma.$queryRaw<Array<{ rbtProfileId: string }>>`
      SELECT DISTINCT "rbtProfileId"
      FROM scheduling_exclusions
      WHERE "expiresAt" IS NULL OR "expiresAt" > NOW()
    `
    const activeExcludedIds = new Set(activeExcludedRows.map((row) => row.rbtProfileId))
    const activeExcludedCount = activeExcludedIds.size

    const validCoords = rbtsWithCoords.filter((r) => {
      if (activeExcludedIds.has(r.id)) return false
      const lat = r.latitude!
      const lng = r.longitude!
      if (lat === 0 && lng === 0) return false
      if (lat === clientCoords.lat && lng === clientCoords.lng) return false
      return true
    })
    const excludedCount = rbtsTotal - validCoords.length

    const withDistance = validCoords
      .map((r) => ({
        ...r,
        straightLineMiles: haversineMiles(
          clientCoords.lat,
          clientCoords.lng,
          r.latitude!,
          r.longitude!
        ),
      }))
      .filter((r) => r.straightLineMiles <= STRAIGHT_LINE_MILES)
      .sort((a, b) => a.straightLineMiles - b.straightLineMiles)
      .slice(0, HAVERSINE_TOP)

    if (withDistance.length === 0) {
      return NextResponse.json({
        rbts: [],
        excludedCount,
        activeExcludedCount,
        message: 'No RBTs found within 30 miles of this address.',
      })
    }

    const coords = [
      `${clientCoords.lng},${clientCoords.lat}`,
      ...withDistance.map((r) => `${r.longitude},${r.latitude}`),
    ].join(';')
    const destinations = Array.from({ length: withDistance.length }, (_, i) => i + 1).join(';')
    const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&annotations=duration,distance&sources=0&destinations=${destinations}`
    const matrixRes = await fetch(url)
    if (!matrixRes.ok) {
      const err = await matrixRes.text()
      console.error('[proximity] Matrix API error', matrixRes.status, err)
      return NextResponse.json({ error: 'Failed to compute driving distances' }, { status: 500 })
    }
    const matrix = (await matrixRes.json()) as {
      durations?: (number | null)[][]
      distances?: (number | null)[][]
    }
    const durations = matrix.durations?.[0] ?? []
    const distances = matrix.distances?.[0] ?? []

    const withDriving = withDistance
      .map((r, i) => ({
        profile: r,
        durationSec: durations[i] ?? null,
        distanceMeters: distances[i] ?? null,
      }))
      .filter(
        (x) =>
          x.durationSec != null &&
          x.durationSec > 0 &&
          x.distanceMeters != null &&
          x.distanceMeters > 0
      )
      .sort((a, b) => (a.durationSec ?? 0) - (b.durationSec ?? 0))
      .slice(0, limit)

    const rbts = withDriving.map(({ profile, durationSec, distanceMeters }) => {
      const fullAddressParts = [
        profile.addressLine1,
        profile.addressLine2,
        profile.locationCity,
        profile.locationState,
        profile.zipCode,
      ].filter(Boolean)
      const fullAddressStr = fullAddressParts.length ? fullAddressParts.join(', ') : ''
      const daysSet = new Set((profile.availabilitySlots ?? []).map((s) => s.dayOfWeek))
      const availabilityJson = profile.availabilityJson as Record<string, unknown> | null
      return {
        rbtProfileId: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullAddress: fullAddressStr,
        latitude: profile.latitude,
        longitude: profile.longitude,
        drivingDistanceMiles:
          distanceMeters != null
            ? distanceMeters < 161
              ? 0.05
              : Math.round((distanceMeters / 1609.34) * 10) / 10
            : null,
        drivingDurationMinutes: durationSec != null ? Math.round(durationSec / 60) : null,
        transportation: profile.transportation,
        languagesJson: profile.languagesJson,
        availabilityJson: availabilityJson ?? undefined,
        availabilityDayOfWeeks: Array.from(daysSet).sort((a, b) => a - b),
        phoneNumber: profile.phoneNumber,
        email: profile.email,
        status: profile.status,
      }
    })

    return NextResponse.json({
      rbts,
      excludedCount,
      activeExcludedCount,
      clientLng: clientCoords.lng,
      clientLat: clientCoords.lat,
    })
  } catch (e) {
    console.error('[proximity]', e)
    return NextResponse.json({ error: 'Failed to find nearest RBTs' }, { status: 500 })
  }
}
