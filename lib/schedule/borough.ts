/** Infer NYC borough / Long Island from city / zip / free text. */

export const NYC_BOROUGHS = [
  'Bronx',
  'Brooklyn',
  'Manhattan',
  'Queens',
  'Staten Island',
  'Long Island',
] as const

export type NycBorough = (typeof NYC_BOROUGHS)[number]

/** Common ZIP 3-digit prefix → region. */
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
  // Nassau / Suffolk (Long Island)
  '115': 'Long Island',
  '117': 'Long Island',
  '118': 'Long Island',
  '119': 'Long Island',
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
  // Long Island
  'long island': 'Long Island',
  li: 'Long Island',
  nassau: 'Long Island',
  suffolk: 'Long Island',
  jericho: 'Long Island',
  'south huntington': 'Long Island',
  huntington: 'Long Island',
  hicksville: 'Long Island',
  levittown: 'Long Island',
  freeport: 'Long Island',
  'garden city': 'Long Island',
  mineola: 'Long Island',
  hempstead: 'Long Island',
  massapequa: 'Long Island',
  babylon: 'Long Island',
  patchogue: 'Long Island',
  riverhead: 'Long Island',
  'valley stream': 'Long Island',
  'westbury': 'Long Island',
  syosset: 'Long Island',
  plainview: 'Long Island',
  'farmingdale': 'Long Island',
  'east meadow': 'Long Island',
  'uniondale': 'Long Island',
  'rockville centre': 'Long Island',
  'oceanside': 'Long Island',
  'baldwin': 'Long Island',
  'wantagh': 'Long Island',
  'seaford': 'Long Island',
  'bellmore': 'Long Island',
  'merrick': 'Long Island',
  'bethpage': 'Long Island',
  'oyster bay': 'Long Island',
  'glen cove': 'Long Island',
  'port washington': 'Long Island',
  'great neck': 'Long Island',
  'manhasset': 'Long Island',
  'roslyn': 'Long Island',
  'carle place': 'Long Island',
  'new hyde park': 'Long Island',
  'floral park': 'Long Island',
  'franklin square': 'Long Island',
  'elmont': 'Long Island',
  'bay shore': 'Long Island',
  'islip': 'Long Island',
  'smithtown': 'Long Island',
  'commack': 'Long Island',
  'dix hills': 'Long Island',
  'melville': 'Long Island',
  'deer park': 'Long Island',
  'brentwood': 'Long Island',
  'central islip': 'Long Island',
  'hauppauge': 'Long Island',
  'stony brook': 'Long Island',
  'setauket': 'Long Island',
  'port jefferson': 'Long Island',
  'coram': 'Long Island',
  'medford': 'Long Island',
  'ronkonkoma': 'Long Island',
  'holbrook': 'Long Island',
  'holtsville': 'Long Island',
  'centereach': 'Long Island',
  'selden': 'Long Island',
  'lake grove': 'Long Island',
  'nesconset': 'Long Island',
  'kings park': 'Long Island',
  'northport': 'Long Island',
  'huntington station': 'Long Island',
  'greenlawn': 'Long Island',
  'amityville': 'Long Island',
  'copiague': 'Long Island',
  'lindenhurst': 'Long Island',
  'west islip': 'Long Island',
  'east islip': 'Long Island',
  'oakdale': 'Long Island',
  'sayville': 'Long Island',
  'bayport': 'Long Island',
  'blue point': 'Long Island',
  'hampton bays': 'Long Island',
  'southampton': 'Long Island',
  'east hampton': 'Long Island',
  montauk: 'Long Island',
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
  if (lower.includes('long island') || lower.includes('nassau') || lower.includes('suffolk')) {
    return 'Long Island'
  }
  // Unknown free-text cities stay as title case (e.g. Yonkers) for grouping
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

/** Canonical regions always shown in export (even if empty). */
export function ensureAllBoroughSections<T extends { name: string }>(
  grouped: T[],
  emptyFactory: (name: (typeof NYC_BOROUGHS)[number]) => T
): T[] {
  const byName = new Map(grouped.map((g) => [g.name, g]))
  const ordered: T[] = []
  for (const name of NYC_BOROUGHS) {
    ordered.push(byName.get(name) ?? emptyFactory(name))
    byName.delete(name)
  }
  const extras = [...byName.values()].sort(
    (a, b) => boroughSortKey(a.name) - boroughSortKey(b.name) || a.name.localeCompare(b.name)
  )
  return [...ordered, ...extras]
}

export function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,']/g, ' ')
    .replace(/\s+/g, ' ')
}
