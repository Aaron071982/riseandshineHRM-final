const ALLOWED_HOST_SUFFIXES = ['claude.ai', 'claude.com', 'anthropic.com']

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

export function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch {
    return false
  }

  const hostname = parsed.hostname.toLowerCase()
  const isLocal = isLocalDevHost(hostname)

  if (isLocal) {
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }

  if (parsed.protocol !== 'https:') return false

  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  )
}

export function validateRedirectUris(uris: string[]): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(uris) || uris.length === 0) {
    return { ok: false, error: 'redirect_uris is required' }
  }
  for (const uri of uris) {
    if (typeof uri !== 'string' || !isAllowedRedirectUri(uri)) {
      return { ok: false, error: `redirect_uri not allowed: ${uri}` }
    }
  }
  return { ok: true }
}

export function clientAllowsRedirectUri(registered: string[], requested: string): boolean {
  return registered.includes(requested)
}
