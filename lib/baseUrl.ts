/**
 * Canonical public origin for links, OAuth metadata, and emails.
 *
 * Production redirect (Vercel domain settings): non-www → www
 *   riseandshinehrm.com  --307-->  www.riseandshinehrm.com
 *
 * All OAuth issuer/endpoints and WWW-Authenticate resource_metadata MUST use
 * www.riseandshinehrm.com (the destination), never the host that redirects.
 */
const PRODUCTION_CANONICAL_ORIGIN = 'https://www.riseandshinehrm.com'

/**
 * For riseandshinehrm.com in production, always normalize to www (canonical destination).
 */
function normalizeCanonicalBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, '')
  if (process.env.NODE_ENV !== 'production') {
    return trimmed
  }
  try {
    const url = new URL(trimmed)
    if (url.hostname === 'riseandshinehrm.com') {
      url.hostname = 'www.riseandshinehrm.com'
      return url.origin
    }
  } catch {
    // use trimmed as-is
  }
  return trimmed
}

/**
 * Gets the canonical base URL for public-facing links.
 * - Uses NEXT_PUBLIC_BASE_URL if set (normalized to www in production)
 * - In production, defaults to https://www.riseandshinehrm.com
 * - In development, defaults to http://localhost:3000
 *
 * NEVER uses VERCEL_URL for candidate-facing links.
 */
export function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return normalizeCanonicalBaseUrl(process.env.NEXT_PUBLIC_BASE_URL)
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_CANONICAL_ORIGIN
  }

  return 'http://localhost:3000'
}

/**
 * Creates a full URL from a path.
 * @param path Path with leading slash (e.g., "/schedule-interview")
 * @returns Full URL (e.g., "https://www.riseandshinehrm.com/schedule-interview")
 */
export function makePublicUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('Path must start with /')
  }
  return `${getPublicBaseUrl()}${path}`
}
