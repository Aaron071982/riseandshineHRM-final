/** Infer NYC borough from city / zip / free text. */

export const NYC_BOROUGHS = [
  'Bronx',
  'Brooklyn',
  'Manhattan',
  'Queens',
  'Staten Island',
] as const

export type NycBorough = (typeof NYC_BOROUGHS)[number]

/** Common NYC ZIP → borough (first 3 digits / full zip prefixes). */
const ZIP_PREFIX_TO_BOROUGH: Record<string, NycBorough> = {
  // Manhattan 100–102
  '100': 'Manhattan',
  '101': 'Manhattan',
  '102': 'Manhattan',
  // Bronx 104
  '104': 'Bronx',
  // Brooklyn 112
  '112': 'Brooklyn',
  // Queens 110–111, 113–114, 116
  '110': 'Queens',
  '111': 'Queens',
  '113': 'Queens',
  '114': 'Queens',
  '116': 'Queens',
  // Staten Island 103
  '103': 'Staten Island',
}

const CITY_ALIASES: Record<string, NycBorough> = {
  bronx: 'Bronx',
  brooklyn: 'Brooklyn',
  manhattan: 'Manhattan',
  queens: 'Queens',
  'staten island': 'Staten Island',
  si: 'Staten Island',
  nyc: 'Manhattan',
  'new york': 'Manhattan',
  'new york city': 'Manhattan',
  'new york, ny': 'Manhattan',
  // Queens neighborhoods
  jamaica: 'Queens',
  astoria: 'Queens',
  flushing: 'Queens',
  'forest hills': 'Queens',
  'ozone park': 'Queens',
  woodside: 'Queens',
  // Brooklyn
  'brooklyn ny': 'Brooklyn',
  'brooklyn, new york, united states': 'Brooklyn',
}

export function normalizeBorough(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return 'Unassigned'
  const lower = s.toLowerCase().replace(/\s+/g, ' ').trim()
  if (lower === 'na' || lower === 'n/a' || lower === 'none' || lower === 'unknown') {
    return 'Unassigned'
  }
  for (const b of NYC_BOROUGHS) {
    if (lower === b.toLowerCase()) return b
  }
  if (CITY_ALIASES[lower]) return CITY_ALIASES[lower]
  for (const [alias, borough] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) return borough
  }
  if (lower.includes('bronx')) return 'Bronx'
  if (lower.includes('brooklyn')) return 'Brooklyn'
  if (lower.includes('manhattan')) return 'Manhattan'
  if (lower.includes('queens')) return 'Queens'
  if (lower.includes('staten')) return 'Staten Island'
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function boroughFromZip(zip: string | null | undefined): NycBorough | null {
  if (!zip) return null
  const digits = zip.replace(/\D/g, '')
  if (digits.length < 3) return null
  return ZIP_PREFIX_TO_BOROUGH[digits.slice(0, 3)] ?? null
}

export function inferBorough(parts: {
  borough?: string | null
  city?: string | null
  zip?: string | null
  address?: string | null
}): string {
  if (parts.borough?.trim()) return normalizeBorough(parts.borough)
  const fromCity = parts.city ? normalizeBorough(parts.city) : 'Unassigned'
  if (fromCity !== 'Unassigned') return fromCity
  const fromZip = boroughFromZip(parts.zip)
  if (fromZip) return fromZip
  if (parts.address) {
    const fromAddr = normalizeBorough(parts.address)
    if (fromAddr !== 'Unassigned') return fromAddr
  }
  return 'Unassigned'
}

export function boroughSortKey(name: string): number {
  const i = NYC_BOROUGHS.indexOf(name as NycBorough)
  if (i >= 0) return i
  if (name === 'Unassigned') return 100
  return 50
}

export function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,']/g, ' ')
    .replace(/\s+/g, ' ')
}
