/** States Rise & Shine operates in — proximity respects these boundaries. */
export const COVERAGE_STATES = ['NY', 'NJ', 'PA', 'CT', 'FL'] as const

export type CoverageState = (typeof COVERAGE_STATES)[number]

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
