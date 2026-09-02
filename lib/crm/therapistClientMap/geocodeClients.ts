import 'server-only'

import { prisma } from '@/lib/prisma'
import { geocodeAddressWithFallbacks } from '@/lib/mapbox-geocode'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { validateMapCoordinates } from '@/lib/crm/therapistClientMap/coordinateValidation'
import { MAP_THERAPIST_WHERE } from '@/lib/crm/therapistClientMap/constants'

const DELAY_MS = 100

export type GeocodeBatchResult = {
  total: number
  geocoded: number
  failed: number
  invalidated: number
  failedNames: string[]
}

export type RefreshMapGeocodesResult = {
  clients: GeocodeBatchResult
  therapists: GeocodeBatchResult
}

function hasAddressFields(row: {
  addressLine: string | null
  city: string | null
  state: string | null
  zip: string | null
}): boolean {
  return [row.addressLine, row.city, row.state, row.zip].some(
    (v) => !!v?.trim()
  )
}

function hasTherapistAddressFields(row: {
  addressLine1: string | null
  locationCity: string | null
  locationState: string | null
  zipCode: string | null
}): boolean {
  return [row.addressLine1, row.locationCity, row.locationState, row.zipCode].some(
    (v) => !!v?.trim()
  )
}

function formatClientName(row: {
  firstName: string
  lastName: string
  clientCode: string
}): string {
  return `${row.firstName} ${row.lastName}`.trim() || row.clientCode
}

export function formatAddressSummary(row: {
  addressLine?: string | null
  addressLine1?: string | null
  city?: string | null
  locationCity?: string | null
  state?: string | null
  locationState?: string | null
  zip?: string | null
  zipCode?: string | null
}): string {
  return [
    row.addressLine ?? row.addressLine1,
    row.city ?? row.locationCity,
    row.state ?? row.locationState,
    row.zip ?? row.zipCode,
  ]
    .filter((p) => p?.trim())
    .join(', ')
}

async function invalidateBadClientCoordinates(): Promise<number> {
  const clients = await prisma.serviceClient.findMany({
    where: {
      ...NOT_DELETED,
      pipelineStatus: 'LIVE',
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      state: true,
      latitude: true,
      longitude: true,
    },
  })

  let invalidated = 0
  for (const c of clients) {
    if (c.latitude == null || c.longitude == null) continue
    const validation = validateMapCoordinates(c.latitude, c.longitude, c.state)
    if (!validation.valid) {
      await prisma.serviceClient.update({
        where: { id: c.id },
        data: { latitude: null, longitude: null },
      })
      invalidated++
    }
  }
  return invalidated
}

async function invalidateBadTherapistCoordinates(): Promise<number> {
  const therapists = await prisma.rBTProfile.findMany({
    where: {
      ...MAP_THERAPIST_WHERE,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      locationState: true,
      latitude: true,
      longitude: true,
    },
  })

  let invalidated = 0
  for (const t of therapists) {
    if (t.latitude == null || t.longitude == null) continue
    const validation = validateMapCoordinates(
      t.latitude,
      t.longitude,
      t.locationState
    )
    if (!validation.valid) {
      await prisma.rBTProfile.update({
        where: { id: t.id },
        data: { latitude: null, longitude: null },
      })
      invalidated++
    }
  }
  return invalidated
}

async function geocodeClientsMissingCoords(): Promise<GeocodeBatchResult> {
  const clients = await prisma.serviceClient.findMany({
    where: {
      ...NOT_DELETED,
      pipelineStatus: 'LIVE',
      latitude: null,
    },
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      addressLine: true,
      city: true,
      state: true,
      zip: true,
    },
    orderBy: { updatedAt: 'asc' },
  })

  const toGeocode = clients.filter(hasAddressFields)
  let geocoded = 0
  let failed = 0
  const failedNames: string[] = []

  for (const c of toGeocode) {
    const result = await geocodeAddressWithFallbacks(
      c.addressLine,
      c.city,
      c.state,
      c.zip
    )
    await new Promise((r) => setTimeout(r, DELAY_MS))

    if (result) {
      await prisma.serviceClient.update({
        where: { id: c.id },
        data: { latitude: result.lat, longitude: result.lng },
      })
      geocoded++
    } else {
      failed++
      failedNames.push(formatClientName(c))
    }
  }

  return {
    total: toGeocode.length,
    geocoded,
    failed,
    invalidated: 0,
    failedNames,
  }
}

async function geocodeTherapistsMissingCoords(): Promise<GeocodeBatchResult> {
  const therapists = await prisma.rBTProfile.findMany({
    where: {
      ...MAP_THERAPIST_WHERE,
      latitude: null,
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

  const toGeocode = therapists.filter(hasTherapistAddressFields)
  let geocoded = 0
  let failed = 0
  const failedNames: string[] = []

  for (const t of toGeocode) {
    const result = await geocodeAddressWithFallbacks(
      t.addressLine1,
      t.locationCity,
      t.locationState,
      t.zipCode
    )
    await new Promise((r) => setTimeout(r, DELAY_MS))

    if (result) {
      await prisma.rBTProfile.update({
        where: { id: t.id },
        data: { latitude: result.lat, longitude: result.lng },
      })
      geocoded++
    } else {
      failed++
      failedNames.push(`${t.firstName} ${t.lastName}`.trim())
    }
  }

  return {
    total: toGeocode.length,
    geocoded,
    failed,
    invalidated: 0,
    failedNames,
  }
}

/**
 * Drop stale pins, then geocode any address still missing coordinates.
 */
export async function refreshMapGeocodes(): Promise<RefreshMapGeocodesResult> {
  const [clientInvalidated, therapistInvalidated] = await Promise.all([
    invalidateBadClientCoordinates(),
    invalidateBadTherapistCoordinates(),
  ])

  const [clients, therapists] = await Promise.all([
    geocodeClientsMissingCoords(),
    geocodeTherapistsMissingCoords(),
  ])

  return {
    clients: { ...clients, invalidated: clientInvalidated },
    therapists: { ...therapists, invalidated: therapistInvalidated },
  }
}

/** @deprecated Use refreshMapGeocodes */
export async function geocodeServiceClientsMissingCoords(): Promise<GeocodeBatchResult> {
  const invalidated = await invalidateBadClientCoordinates()
  const result = await geocodeClientsMissingCoords()
  return { ...result, invalidated }
}

export type GeocodeClientsResult = GeocodeBatchResult
