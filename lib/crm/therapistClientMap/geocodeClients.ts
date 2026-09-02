import 'server-only'

import { prisma } from '@/lib/prisma'
import { geocodeAddressWithFallbacks } from '@/lib/mapbox-geocode'
import { NOT_DELETED } from '@/lib/crm/softDelete'

const DELAY_MS = 100

export type GeocodeClientsResult = {
  total: number
  geocoded: number
  failed: number
  failedNames: string[]
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

function formatClientName(row: {
  firstName: string
  lastName: string
  clientCode: string
}): string {
  return `${row.firstName} ${row.lastName}`.trim() || row.clientCode
}

/**
 * Geocode LIVE service clients that have an address but no cached pin.
 * Mirrors the RBT geocode-all batch pattern.
 */
export async function geocodeServiceClientsMissingCoords(): Promise<GeocodeClientsResult> {
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
    failedNames,
  }
}

export function formatAddressSummary(row: {
  addressLine: string | null
  city: string | null
  state: string | null
  zip: string | null
}): string {
  return [row.addressLine, row.city, row.state, row.zip]
    .filter((p) => p?.trim())
    .join(', ')
}
