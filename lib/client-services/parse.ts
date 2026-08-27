import { NY_BOROUGHS } from '@/lib/client-services/constants'
import { parseCalendarDate } from '@/lib/billing/calendarDate'

export type ParsedAddress = {
  addressLine: string | null
  city: string | null
  borough: string | null
  state: string | null
  zip: string | null
}

export function detectBorough(text: string | null | undefined): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const b of NY_BOROUGHS) {
    if (lower.includes(b.toLowerCase())) return b
  }
  if (lower.includes('staten')) return 'Staten Island'
  // Common NYC neighborhood → borough hints
  if (
    /\b(jamaica|flushing|astoria|forest hills|jackson heights|corona|elmhurst|ridgewood|woodside|bayside|far rockaway)\b/.test(
      lower
    )
  ) {
    return 'Queens'
  }
  if (/\b(harlem|washington heights|inwood|chelsea|midtown|battery|hell'?s kitchen)\b/.test(lower)) {
    return 'Manhattan'
  }
  return null
}

/**
 * Parse free-text address into line / city / borough / state / zip.
 * Handles formats like:
 *   "1154 E 212th St, Bronx, NY"
 *   "2604 East 11th Street, Brooklyn, NY 11207"
 *   "1874 Pelham Parkway South,Bronx,NY 10461"
 */
export function parseAddress(raw: string | null | undefined): ParsedAddress {
  const empty: ParsedAddress = {
    addressLine: null,
    city: null,
    borough: null,
    state: null,
    zip: null,
  }
  if (!raw?.trim()) return empty

  const text = raw.trim().replace(/\s+/g, ' ')
  const borough = detectBorough(text)

  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/)
  const zip = zipMatch?.[1] ?? null

  const stateMatch = text.match(/\b(NY|New York)\b/i)
  const state = stateMatch ? 'NY' : null

  // Split on commas
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean)

  let addressLine: string | null = parts[0] ?? text
  let city: string | null = null

  if (borough) {
    city = borough
    // If first part already contains borough, keep street portion
    if (parts.length >= 2) {
      addressLine = parts[0]
    }
  } else if (parts.length >= 2) {
    addressLine = parts[0]
    // Second part may be "Brooklyn NY 11207" or "NY 11207"
    const mid = parts[1].replace(/\bNY\b/i, '').replace(/\d{5}(-\d{4})?/, '').trim()
    city = mid || null
  }

  return { addressLine, city, borough, state, zip }
}

export function splitClientName(fullName: string | null | undefined): {
  firstName: string
  lastName: string
} {
  const cleaned = (fullName ?? '').trim().replace(/\s+/g, ' ')
  if (!cleaned) return { firstName: 'Unknown', lastName: 'Unknown' }
  const parts = cleaned.split(' ')
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

export function parseCsvStatus(raw: string | null | undefined): 'NEW' | 'ACTIVE' | 'ON_HOLD' | 'DISCHARGED' {
  const s = (raw ?? '').trim().toLowerCase()
  if (s === 'active') return 'ACTIVE'
  if (s === 'new') return 'NEW'
  if (s.includes('hold')) return 'ON_HOLD'
  if (s.includes('discharge')) return 'DISCHARGED'
  if (!s) return 'NEW'
  return 'ACTIVE'
}

export function parseDateLoose(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null
  const parsed = parseCalendarDate(raw.trim())
  if (parsed) return parsed
  return null
}

export function parseNumberLoose(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null
  const n = Number(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

export function parseYesNo(raw: string | null | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === 'yes'
}

export function splitBtNames(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
}

export function ageFromDob(dob: Date | string | null | undefined): number | null {
  if (!dob) return null
  const d = typeof dob === 'string' ? new Date(dob) : dob
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getUTCFullYear()
  const m = today.getMonth() - d.getUTCMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getUTCDate())) age -= 1
  return age
}
