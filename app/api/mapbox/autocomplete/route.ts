import { NextRequest, NextResponse } from 'next/server'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

/**
 * GET /api/mapbox/autocomplete?q=...&session_token=...
 * Returns address suggestions from Mapbox Searchbox API (US addresses only).
 */
export async function GET(request: NextRequest) {
  if (!MAPBOX_TOKEN) {
    return NextResponse.json([])
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const sessionToken = request.nextUrl.searchParams.get('session_token') ?? ''

  if (q.length < 3) {
    return NextResponse.json([])
  }

  try {
    const params = new URLSearchParams({
      q,
      access_token: MAPBOX_TOKEN,
      country: 'us',
      types: 'address',
      limit: '5',
    })
    if (sessionToken) params.set('session_token', sessionToken)

    const res = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`
    )

    if (!res.ok) {
      console.error('Mapbox autocomplete error:', res.status, await res.text())
      return NextResponse.json([])
    }

    const data = (await res.json()) as {
      suggestions?: Array<{
        mapbox_id?: string
        name?: string
        full_address?: string
        address?: string
        place_formatted?: string
      }>
    }

    const suggestions = (data.suggestions ?? []).map((s) => ({
      mapbox_id: s.mapbox_id ?? '',
      full_address: s.full_address ?? [s.address, s.place_formatted].filter(Boolean).join(', ') ?? '',
      place_name: s.name ?? '',
    })).filter((s) => s.mapbox_id)

    return NextResponse.json(suggestions)
  } catch (e) {
    console.error('Mapbox autocomplete:', e)
    return NextResponse.json([])
  }
}
