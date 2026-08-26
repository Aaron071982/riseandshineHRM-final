/**
 * Convert YouTube watch/share URLs to privacy-enhanced embed URLs.
 * Rejects non-YouTube hosts.
 */

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/

export function extractYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.has(host)) return null

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    return VIDEO_ID_RE.test(id) ? id : null
  }

  const v = url.searchParams.get('v')
  if (v && VIDEO_ID_RE.test(v)) return v

  const parts = url.pathname.split('/').filter(Boolean)
  // /embed/ID, /shorts/ID, /live/ID, /v/ID
  const embedIdx = parts.findIndex((p) =>
    ['embed', 'shorts', 'live', 'v'].includes(p)
  )
  if (embedIdx >= 0) {
    const id = parts[embedIdx + 1] ?? ''
    return VIDEO_ID_RE.test(id) ? id : null
  }

  return null
}

/** Returns youtube-nocookie.com/embed/{id} or null if invalid / non-YouTube. */
export function toYouTubeNoCookieEmbed(raw: string): string | null {
  const id = extractYouTubeVideoId(raw)
  if (!id) return null
  return `https://www.youtube-nocookie.com/embed/${id}`
}

export function isYouTubeNoCookieEmbed(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host !== 'www.youtube-nocookie.com' && host !== 'youtube-nocookie.com') {
      return false
    }
    const parts = u.pathname.split('/').filter(Boolean)
    return parts[0] === 'embed' && VIDEO_ID_RE.test(parts[1] ?? '')
  } catch {
    return false
  }
}
