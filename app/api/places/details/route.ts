import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

type AddressComponent = {
  longText?: string
  shortText?: string
  long_name?: string
  short_name?: string
  types?: string[]
}

function getComponent(
  components: AddressComponent[],
  type: string,
  useShort = false
): string {
  const c = components.find((x) => x.types?.includes(type))
  if (!c) return ''
  const long = c.longText ?? c.long_name ?? ''
  const short = c.shortText ?? c.short_name ?? ''
  return useShort ? short : long
}

/**
 * GET /api/places/details?placeId=ChIJ...
 * Returns parsed address (addressLine1, city, state, zipCode) for autofill. No map.
 */
export async function GET(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'Places API not configured' },
      { status: 503 }
    )
  }

  const placeId = request.nextUrl.searchParams.get('placeId')
  if (!placeId) {
    return NextResponse.json({ error: 'Missing placeId' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'addressComponents,formattedAddress',
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Places details error:', res.status, err)
      return NextResponse.json(
        { error: 'Failed to get address details' },
        { status: res.status }
      )
    }

    const place = (await res.json()) as {
      addressComponents?: AddressComponent[]
      formattedAddress?: string
    }

    const components = place.addressComponents ?? []
    const streetNumber = getComponent(components, 'street_number')
    const route = getComponent(components, 'route')
    const addressLine1 = [streetNumber, route].filter(Boolean).join(' ').trim() || ''
    const city =
      getComponent(components, 'locality') ||
      getComponent(components, 'sublocality_level_1') ||
      getComponent(components, 'sublocality')
    const state = getComponent(components, 'administrative_area_level_1', true)
    const zipCode =
      getComponent(components, 'postal_code') +
      (getComponent(components, 'postal_code_suffix')
        ? `-${getComponent(components, 'postal_code_suffix')}`
        : '')

    return NextResponse.json({
      addressLine1,
      addressLine2: null,
      city,
      state,
      zipCode,
      formattedAddress: place.formattedAddress ?? null,
    })
  } catch (e) {
    console.error('Places details:', e)
    return NextResponse.json(
      { error: 'Failed to get address details' },
      { status: 500 }
    )
  }
}
