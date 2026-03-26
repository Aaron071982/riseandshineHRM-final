/**
 * Mapbox Geocoding: forward geocode an address to lat/lng.
 * Uses Geocoding v5 mapbox.places endpoint.
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const US_LAT_MIN = 24
const US_LAT_MAX = 50
const US_LNG_MIN = -125
const US_LNG_MAX = -66

export interface GeocodeResult {
  lat: number
  lng: number
}

export interface GeocodeResultWithFormat extends GeocodeResult {
  formatUsed: string
}

function inUSBounds(lat: number, lng: number): boolean {
  return lat >= US_LAT_MIN && lat <= US_LAT_MAX && lng >= US_LNG_MIN && lng <= US_LNG_MAX
}

type MapboxFeature = {
  geometry?: { coordinates?: [number, number] }
  center?: [number, number]
}

function parseCoords(data: { features?: MapboxFeature[] }): { lat: number; lng: number } | null {
  const f = data.features?.[0]
  if (!f) return null
  const coords = f.geometry?.coordinates ?? f.center
  if (!coords || coords.length < 2) return null
  const [lng, lat] = coords
  if (typeof lng !== 'number' || typeof lat !== 'number') return null
  if (!inUSBounds(lat, lng)) return null
  return { lat, lng }
}

/**
 * Single geocode attempt. Returns null if token missing, no result, or out of US bounds.
 */
export async function geocodeAddress(
  addressLine1: string | null | undefined,
  city?: string | null,
  state?: string | null,
  zip?: string | null
): Promise<GeocodeResult | null> {
  const result = await geocodeAddressWithFallbacks(addressLine1, city, state, zip)
  return result ? { lat: result.lat, lng: result.lng } : null
}

const FORMATS: { name: string; parts: (keyof { a: string; c: string; s: string; z: string })[] }[] = [
  { name: 'full', parts: ['a', 'c', 's', 'z'] },
  { name: 'street_city_state', parts: ['a', 'c', 's'] },
  { name: 'city_state_zip', parts: ['c', 's', 'z'] },
  { name: 'zip_only', parts: ['z'] },
]

export type GeocodeDebugLog = (format: string, url: string, response: unknown, failureReason?: string) => void

/**
 * Try up to four address formats until one returns a valid US result. Returns result + formatUsed for logging.
 * If debugLog is provided, it is called for each attempt (e.g. for first 3 RBTs) with redacted URL and full response.
 */
export async function geocodeAddressWithFallbacks(
  addressLine1: string | null | undefined,
  city?: string | null,
  state?: string | null,
  zip?: string | null,
  debugLog?: GeocodeDebugLog
): Promise<GeocodeResultWithFormat | null> {
  if (!MAPBOX_TOKEN) return null
  const a = (addressLine1 != null && String(addressLine1).trim()) || ''
  const c = (city != null && String(city).trim()) || ''
  const s = (state != null && String(state).trim()) || ''
  const z = (zip != null && String(zip).trim()) || ''

  for (const fmt of FORMATS) {
    const parts: string[] = []
    for (const key of fmt.parts) {
      if (key === 'a' && a) parts.push(a)
      if (key === 'c' && c) parts.push(c)
      if (key === 's' && s) parts.push(s)
      if (key === 'z' && z) parts.push(z)
    }
    const query = parts.join(', ').trim()
    if (!query) continue

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=us&limit=1`
    const urlRedacted = url.replace(MAPBOX_TOKEN, '***')

    try {
      const res = await fetch(url)
      const data = (await res.json()) as { features?: MapboxFeature[] }
      if (!res.ok) {
        if (debugLog) debugLog(fmt.name, urlRedacted, data, `status ${res.status}`)
        continue
      }
      const coords = parseCoords(data)
      if (coords) {
        if (debugLog) debugLog(fmt.name, urlRedacted, data)
        return { ...coords, formatUsed: fmt.name }
      }
      const reason = !data.features?.length ? 'no features' : 'out of US bounds'
      if (debugLog) debugLog(fmt.name, urlRedacted, data, reason)
    } catch {
      if (debugLog) debugLog(fmt.name, urlRedacted, null, 'fetch error')
      // try next format
    }
  }
  return null
}
