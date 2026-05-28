import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { geocodeAddress } from '@/lib/mapbox-geocode'
import { haversineMiles } from '@/lib/scheduling-beta/zipToCoord'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const STRAIGHT_LINE_MILES = 30
const HAVERSINE_TOP = 15

export interface ProximityAddressInput {
  clientAddress?: string | null
  clientCity?: string | null
  clientState?: string | null
  clientZip?: string | null
}

export interface RunRbtProximitySearchOptions extends ProximityAddressInput {
  /** If set, used instead of geocoding an address. */
  clientLatitude?: number | null
  clientLongitude?: number | null
  /** Max driving-ranked results (after matrix). */
  limit?: number
  /** Extra Prisma where on RBTProfile (merged with coords filter). */
  rbtWhere?: Prisma.RBTProfileWhereInput
  /** Exclude these RBT profile IDs before ranking. */
  excludeRbtProfileIds?: string[]
}

export type ProximityRbtRow = {
  rbtProfileId: string
  firstName: string
  lastName: string
  fullAddress: string
  latitude: number | null
  longitude: number | null
  drivingDistanceMiles: number | null
  drivingDurationMinutes: number | null
  transportation: boolean | null
  languagesJson: unknown
  availabilityJson?: Record<string, unknown>
  availabilityDayOfWeeks: number[]
  phoneNumber: string
  email: string | null
  status: unknown
}

export interface RunRbtProximitySearchResult {
  rbts: ProximityRbtRow[]
  excludedCount: number
  activeExcludedCount: number
  clientLng: number
  clientLat: number
  message?: string
  geocodeError?: 'MISSING_ADDRESS' | 'GEOCODE_FAILED'
}

/** Mapbox geocode + driving matrix flow for scheduling-beta proximity search. */
export async function runRbtProximitySearch(
  opts: RunRbtProximitySearchOptions
): Promise<RunRbtProximitySearchResult | { error: string; code: string; status: number }> {
  const clientAddress = typeof opts.clientAddress === 'string' ? opts.clientAddress.trim() : ''
  const clientCity = typeof opts.clientCity === 'string' ? opts.clientCity.trim() : ''
  const clientState = typeof opts.clientState === 'string' ? opts.clientState.trim() : ''
  const clientZip = typeof opts.clientZip === 'string' ? opts.clientZip.trim() : ''
  const limit = Math.min(10, Math.max(1, Number(opts.limit) ?? 6))
  const excludeIds = new Set(opts.excludeRbtProfileIds ?? [])

  const latOpt = opts.clientLatitude
  const lngOpt = opts.clientLongitude
  const hasStoredCoords =
    latOpt != null &&
    lngOpt != null &&
    Number.isFinite(Number(latOpt)) &&
    Number.isFinite(Number(lngOpt)) &&
    !(Number(latOpt) === 0 && Number(lngOpt) === 0)

  let clientCoords: { lat: number; lng: number }

  if (hasStoredCoords) {
    clientCoords = { lat: Number(latOpt), lng: Number(lngOpt) }
  } else {
    const fullAddress = [clientAddress, clientCity, clientState, clientZip].filter(Boolean).join(', ').trim()
    if (!fullAddress) {
      return { error: 'Client address is required', code: 'MISSING_ADDRESS', status: 400 }
    }

    const geocoded = await geocodeAddress(
      clientAddress || null,
      clientCity || null,
      clientState || null,
      clientZip || null
    )
    if (!geocoded) {
      return { error: 'Could not find this address. Please check and try again.', code: 'GEOCODE_FAILED', status: 422 }
    }
    clientCoords = geocoded
  }

  const baseWhere: Prisma.RBTProfileWhereInput = {
    latitude: { not: null },
    longitude: { not: null },
    ...opts.rbtWhere,
  }

  const [rbtsWithCoords, rbtsTotal] = await Promise.all([
    prisma.rBTProfile.findMany({
      where: baseWhere,
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
    prisma.rBTProfile.count({ where: opts.rbtWhere ?? {} }),
  ])

  const activeExcludedRows = await prisma.$queryRaw<Array<{ rbtProfileId: string }>>`
    SELECT DISTINCT "rbtProfileId"
    FROM scheduling_exclusions
    WHERE "expiresAt" IS NULL OR "expiresAt" > NOW()
  `
  const activeExcludedIds = new Set(activeExcludedRows.map((row) => row.rbtProfileId))
  const activeExcludedCount = activeExcludedIds.size

  const validCoords = rbtsWithCoords.filter((r) => {
    if (excludeIds.has(r.id)) return false
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
      straightLineMiles: haversineMiles(clientCoords.lat, clientCoords.lng, r.latitude!, r.longitude!),
    }))
    .filter((r) => r.straightLineMiles <= STRAIGHT_LINE_MILES)
    .sort((a, b) => a.straightLineMiles - b.straightLineMiles)
    .slice(0, HAVERSINE_TOP)

  if (withDistance.length === 0) {
    return {
      rbts: [],
      excludedCount,
      activeExcludedCount,
      clientLng: clientCoords.lng,
      clientLat: clientCoords.lat,
      message: 'No RBTs found within 30 miles of this address.',
    }
  }

  const coords = [`${clientCoords.lng},${clientCoords.lat}`, ...withDistance.map((r) => `${r.longitude},${r.latitude}`)].join(
    ';'
  )
  const destinations = Array.from({ length: withDistance.length }, (_, i) => i + 1).join(';')
  const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&annotations=duration,distance&sources=0&destinations=${destinations}`
  const matrixRes = await fetch(url)
  if (!matrixRes.ok) {
    const err = await matrixRes.text()
    console.error('[proximity] Matrix API error', matrixRes.status, err)
    return { error: 'Failed to compute driving distances', code: 'MATRIX_FAILED', status: 500 }
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
        x.durationSec != null && x.durationSec > 0 && x.distanceMeters != null && x.distanceMeters > 0
    )
    .sort((a, b) => (a.durationSec ?? 0) - (b.durationSec ?? 0))
    .slice(0, limit)

  const rbts: ProximityRbtRow[] = withDriving.map(({ profile, durationSec, distanceMeters }) => {
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

  return {
    rbts,
    excludedCount,
    activeExcludedCount,
    clientLng: clientCoords.lng,
    clientLat: clientCoords.lat,
  }
}
