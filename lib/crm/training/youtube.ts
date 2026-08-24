/**
 * Extract an 11-character YouTube video ID from common URL formats.
 * Returns null when the input is not a recognizable YouTube URL.
 */
export function extractYoutubeVideoId(raw: string): string | null {
  const input = raw.trim()
  if (!input) return null

  // Bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input

  let url: URL
  try {
    url = new URL(input.includes('://') ? input : `https://${input}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
  }

  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    const v = url.searchParams.get('v')
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v

    const parts = url.pathname.split('/').filter(Boolean)
    // /embed/ID, /shorts/ID, /live/ID, /v/ID
    if (
      parts.length >= 2 &&
      ['embed', 'shorts', 'live', 'v'].includes(parts[0]) &&
      /^[a-zA-Z0-9_-]{11}$/.test(parts[1])
    ) {
      return parts[1]
    }
  }

  return null
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}
