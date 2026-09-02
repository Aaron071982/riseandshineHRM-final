/** States Rise & Shine operates in — proximity respects these boundaries. */
export const COVERAGE_STATES = ['NY', 'NJ', 'PA', 'CT', 'FL'] as const

export type CoverageState = (typeof COVERAGE_STATES)[number]

/** Approximate bounding boxes [west, south, east, north] for map pin validation. */
export const STATE_BBOX: Record<CoverageState, [number, number, number, number]> = {
  NY: [-79.76, 40.49, -71.85, 45.02],
  NJ: [-75.56, 38.93, -73.89, 41.36],
  PA: [-80.52, 39.72, -74.69, 42.27],
  CT: [-73.73, 40.98, -71.79, 42.05],
  FL: [-87.63, 24.52, -80.03, 31.0],
}

export function getStateBboxParam(
  state: string | null | undefined
): string | undefined {
  const s = normalizeUsState(state)
  if (!s || !isCoverageState(s)) return undefined
  const [west, south, east, north] = STATE_BBOX[s as CoverageState]
  return `${west},${south},${east},${north}`
}

export function isPointInStateBbox(
  lat: number,
  lng: number,
  state: CoverageState
): boolean {
  const [west, south, east, north] = STATE_BBOX[state]
  return lng >= west && lng <= east && lat >= south && lat <= north
}

export function isPointInCoverageArea(lat: number, lng: number): boolean {
  return COVERAGE_STATES.some((s) => isPointInStateBbox(lat, lng, s))
}

export function normalizeUsState(
  value: string | null | undefined
): string | null {
  const raw = value?.trim().toUpperCase()
  if (!raw) return null
  if (raw.length === 2) return raw
  const map: Record<string, string> = {
    'NEW YORK': 'NY',
    'NEW JERSEY': 'NJ',
    PENNSYLVANIA: 'PA',
    CONNECTICUT: 'CT',
    FLORIDA: 'FL',
  }
  return map[raw] ?? raw.slice(0, 2)
}

export function isCoverageState(state: string | null | undefined): boolean {
  const s = normalizeUsState(state)
  return !!s && (COVERAGE_STATES as readonly string[]).includes(s)
}

/** Same-state required for viable match when both states are known. */
export function statesAreCompatible(
  clientState: string | null | undefined,
  therapistState: string | null | undefined
): boolean {
  const c = normalizeUsState(clientState)
  const t = normalizeUsState(therapistState)
  if (!c || !t) return true
  return c === t
}
