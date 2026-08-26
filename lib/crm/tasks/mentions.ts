const MENTION_RE = /@\[([^\]]+)\]\(([a-z0-9]+)\)/gi

export function parseMentionIds(body: string): string[] {
  const ids = new Set<string>()
  for (const match of body.matchAll(MENTION_RE)) {
    const id = match[2]
    if (id) ids.add(id)
  }
  return [...ids]
}

export function formatMentionDisplay(name: string, userId: string): string {
  const safe = name.trim().replace(/[\[\]]/g, '') || 'User'
  return `@[${safe}](${userId})`
}

export function renderMentionBody(body: string): string {
  return body.replace(MENTION_RE, '@$1')
}

/**
 * Active @-mention query at the end of the draft, or null if not mentioning.
 * Empty string means the user typed `@` alone (show everyone).
 * Completed tokens `@[Name](id)` are ignored.
 */
export function getActiveMentionQuery(text: string): string | null {
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] !== '@') continue
    const prev = i === 0 ? ' ' : text[i - 1]!
    if (i > 0 && !/[\s([{,]/.test(prev)) continue

    const after = text.slice(i)
    const completed = after.match(/^@\[[^\]]*\]\([a-z0-9]+\)(\s*)$/i)
    if (completed) return null

    const completedPrefix = after.match(/^@\[[^\]]*\]\([a-z0-9]+\)/i)
    if (completedPrefix) {
      // Completed token with more text after it — keep scanning for a later @
      continue
    }

    const query = after.slice(1)
    // Mid-token (already picked format being edited) — don't open picker
    if (query.startsWith('[')) return null
    return query
  }
  return null
}

/** Replace the active unfinished @query at the end with a formatted mention token. */
export function applyMentionPick(
  text: string,
  displayName: string,
  userId: string
): string {
  const token = formatMentionDisplay(displayName, userId) + ' '
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] !== '@') continue
    const prev = i === 0 ? ' ' : text[i - 1]!
    if (i > 0 && !/[\s([{,]/.test(prev)) continue
    const after = text.slice(i)
    if (/^@\[[^\]]*\]\([a-z0-9]+\)/i.test(after)) continue
    return text.slice(0, i) + token
  }
  return `${text}${token}`
}
