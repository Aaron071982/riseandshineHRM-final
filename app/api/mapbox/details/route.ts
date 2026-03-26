import { NextRequest, NextResponse } from 'next/server'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

type MapboxContext = {
  place?: { name?: string }
  locality?: { name?: string }
  region?: { region_code?: string; name?: string }
  postcode?: { name?: string }
  address?: { name?: string; address_number?: string; street_name?: string }
}

/**
 * GET /api/mapbox/details?mapbox_id=...&session_token=...
 * Returns structured address from Mapbox Searchbox retrieve.
 */
export async function GET(request: NextRequest) {
  if (!MAPBOX_TOKEN) {
    return NextResponse.json(
      { error: 'Mapbox not configured' },
      { status: 503 }
    )
  }

  const mapboxId = request.nextUrl.searchParams.get('mapbox_id')?.trim()
  const sessionToken = request.nextUrl.searchParams.get('session_token') ?? ''

  if (!mapboxId) {
    return NextResponse.json({ error: 'Missing mapbox_id' }, { status: 400 })
  }

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
    })
    if (sessionToken) params.set('session_token', sessionToken)

    const res = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?${params.toString()}`
    )

    if (!res.ok) {
      console.error('Mapbox details error:', res.status, await res.text())
      return NextResponse.json(
        { error: 'Failed to get address details' },
        { status: res.status }
      )
    }

    const data = (await res.json()) as {
      type?: string
      features?: Array<{
        type?: string
        properties?: {
          address?: string
          full_address?: string
          place_formatted?: string
          context?: MapboxContext
        }
      }>
    }

    const feature = data.features?.[0]
    const props = feature?.properties
    if (!props) {
      return NextResponse.json(
        { error: 'No feature found' },
        { status: 404 }
      )
    }

    const ctx = props.context ?? {}
    const city =
      ctx.place?.name ??
      ctx.locality?.name ??
      ''
    const stateRaw = ctx.region?.region_code ?? ctx.region?.name ?? ''
    const state = stateRaw.length === 2 ? stateRaw : stateRaw.slice(0, 2).toUpperCase()
    const postcodeRaw = ctx.postcode?.name ?? ''
    const postcode = postcodeRaw.replace(/\D/g, '').slice(0, 5)

    const addressLine1 = props.address ?? (ctx.address ? [ctx.address.address_number, ctx.address.street_name].filter(Boolean).join(' ') : undefined) ?? ''

    return NextResponse.json({
      address_line1: addressLine1,
      address_line2: '',
      city,
      state,
      postcode,
      full_address: props.full_address ?? [addressLine1, props.place_formatted].filter(Boolean).join(', ') ?? '',
    })
  } catch (e) {
    console.error('Mapbox details:', e)
    return NextResponse.json(
      { error: 'Failed to get address details' },
      { status: 500 }
    )
  }
}
