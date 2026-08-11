/** Format / parse Client Services activity notes stored as plain text. */

export function formatActivityNote(title: string, details?: string | null): string {
  const t = title.trim()
  const d = (details ?? '').trim()
  if (!t && !d) return ''
  if (!d) return `# ${t || d}`
  if (!t) return d
  return `# ${t}\n${d}`
}

export function parseActivityNote(content: string): { title: string; body: string | null } {
  const trimmed = (content ?? '').trim()
  if (!trimmed) return { title: 'Note', body: null }

  if (trimmed.startsWith('#')) {
    const rest = trimmed.replace(/^#\s*/, '')
    const nl = rest.indexOf('\n')
    if (nl === -1) return { title: rest.trim() || 'Note', body: null }
    const title = rest.slice(0, nl).trim() || 'Note'
    const body = rest.slice(nl + 1).trim()
    return { title, body: body || null }
  }

  // Legacy [Break] / [Edit] / [Status] prefixes — first line is title
  const lines = trimmed.split(/\n/)
  const first = lines[0].trim()
  const title = first.replace(/^\[(Break|Edit|Status)\]\s*/i, '').trim() || first
  const body = lines.slice(1).join('\n').trim()
  if (lines.length === 1) {
    // Single-line legacy: use short title, full text as body if long
    if (first.length > 72) {
      return { title: first.slice(0, 69) + '…', body: first }
    }
    return { title, body: null }
  }
  return { title, body: body || null }
}
