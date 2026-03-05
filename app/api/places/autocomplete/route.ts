import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

/**
 * POST /api/places/autocomplete
 * Body: { input: string }
 * Returns address predictions from Google Places API (New). No map script loaded on client.
 */
export async function POST(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'Places API not configured', predictions: [] },
      { status: 200 }
    )
  }

  try {
    const body = await request.json()
    const input = typeof body?.input === 'string' ? body.input.trim() : ''
    if (!input || input.length < 3) {
      return NextResponse.json({ predictions: [] })
    }

    const res = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ['us'],
          languageCode: 'en',
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Places autocomplete error:', res.status, err)
      return NextResponse.json({ predictions: [] })
    }

    const data = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string
          text?: { text?: string }
        }
      }>
    }

    const predictions =
      data.suggestions?.map((s) => ({
        placeId: s.placePrediction?.placeId ?? '',
        description: s.placePrediction?.text?.text ?? '',
      })).filter((p) => p.placeId && p.description) ?? []

    return NextResponse.json({ predictions })
  } catch (e) {
    console.error('Places autocomplete:', e)
    return NextResponse.json({ predictions: [] })
  }
}
