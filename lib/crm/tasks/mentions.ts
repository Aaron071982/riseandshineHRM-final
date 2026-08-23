const MENTION_RE = /@\[([^\]]+)\]\(([a-z0-9]+)\)/g

export function parseMentionIds(body: string): string[] {
  const ids = new Set<string>()
  for (const match of body.matchAll(MENTION_RE)) {
    const id = match[2]
    if (id) ids.add(id)
  }
  return [...ids]
}

export function formatMentionDisplay(name: string, userId: string): string {
  const safe = name.trim() || 'User'
  return `@[${safe}](${userId})`
}

export function renderMentionBody(body: string): string {
  return body.replace(MENTION_RE, '@$1')
}
