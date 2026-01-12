/**
 * Gets the canonical base URL for public-facing links.
 * - Uses NEXT_PUBLIC_BASE_URL if set (full URL like "https://riseandshinehrm.com")
 * - In production, defaults to "https://riseandshinehrm.com" (canonical domain)
 * - In development, defaults to "http://localhost:3000"
 * 
 * NEVER uses VERCEL_URL for candidate-facing links.
 */
export function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  
  if (process.env.NODE_ENV === 'production') {
    return 'https://riseandshinehrm.com'
  }
  
  return 'http://localhost:3000'
}

/**
 * Creates a full URL from a path.
 * @param path Path with leading slash (e.g., "/schedule-interview")
 * @returns Full URL (e.g., "https://riseandshinehrm.com/schedule-interview")
 */
export function makePublicUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('Path must start with /')
  }
  return `${getPublicBaseUrl()}${path}`
}
