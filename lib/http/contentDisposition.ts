/**
 * Build RFC 6266 / RFC 5987 Content-Disposition values safe for Node fetch/Response
 * headers (ByteString — Latin-1 only in the legacy filename= parameter).
 */
export function sanitizeAsciiFileName(fileName: string): string {
  const normalized = fileName
    .replace(/[\u202F\u00A0]/g, ' ')
    .replace(/"/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || 'download'
}

export function buildContentDisposition(
  disposition: 'inline' | 'attachment',
  fileName: string
): string {
  const trimmed = fileName.trim() || 'download'
  const ascii = sanitizeAsciiFileName(trimmed)
  const encoded = encodeURIComponent(trimmed.replace(/"/g, ''))
  if (ascii === trimmed.replace(/"/g, '')) {
    return `${disposition}; filename="${ascii}"`
  }
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

export function parseContentDispositionFileName(
  header: string | null | undefined
): string | null {
  if (!header) return null

  const star = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;\n]+)/i)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      /* fall through */
    }
  }

  const quoted = header.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1]

  const unquoted = header.match(/filename=([^;\n]+)/i)
  if (unquoted?.[1]) return unquoted[1].trim()

  return null
}
