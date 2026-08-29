import type { ClientOwnerDept } from '@prisma/client'

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/gi
const COMPLETED_MENTION_PREFIX = /^@\[[^\]]*\]\([^)]+\)/i
const COMPLETED_MENTION_SUFFIX = /^@\[[^\]]*\]\([^)]+\)(\s*)$/i

export const DEPT_MENTION_PREFIX = 'dept:'

export const TASK_MENTION_DEPTS: ClientOwnerDept[] = [
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
]

export type MentionTargetKind = 'user' | 'dept'

export type ParsedMentionTargets = {
  userIds: string[]
  depts: ClientOwnerDept[]
  tokens: string[]
}

export function isDeptMentionToken(token: string): boolean {
  return token.startsWith(DEPT_MENTION_PREFIX)
}

export function parseDeptMentionToken(token: string): ClientOwnerDept | null {
  if (!isDeptMentionToken(token)) return null
  const dept = token.slice(DEPT_MENTION_PREFIX.length) as ClientOwnerDept
  return TASK_MENTION_DEPTS.includes(dept) ? dept : null
}

export function formatMentionDisplay(name: string, tokenId: string): string {
  const safe = name.trim().replace(/[\[\]]/g, '') || 'User'
  return `@[${safe}](${tokenId})`
}

export function formatDeptMentionDisplay(
  label: string,
  dept: ClientOwnerDept
): string {
  return formatMentionDisplay(label, `${DEPT_MENTION_PREFIX}${dept}`)
}

export function parseMentionTargets(body: string): ParsedMentionTargets {
  const userIds = new Set<string>()
  const depts = new Set<ClientOwnerDept>()
  const tokens = new Set<string>()

  for (const match of body.matchAll(MENTION_RE)) {
    const token = match[2]?.trim()
    if (!token) continue
    tokens.add(token)
    const dept = parseDeptMentionToken(token)
    if (dept) {
      depts.add(dept)
      continue
    }
    if (!token.includes(':')) {
      userIds.add(token)
    }
  }

  return {
    userIds: [...userIds],
    depts: [...depts],
    tokens: [...tokens],
  }
}

export function parseMentionIds(body: string): string[] {
  return parseMentionTargets(body).userIds
}

export function renderMentionBody(body: string): string {
  return body.replace(MENTION_RE, '@$1')
}

export function splitMentionBody(
  body: string
): { type: 'text' | 'mention'; value: string }[] {
  const parts: { type: 'text' | 'mention'; value: string }[] = []
  let lastIndex = 0
  for (const match of body.matchAll(MENTION_RE)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      parts.push({ type: 'text', value: body.slice(lastIndex, index) })
    }
    parts.push({ type: 'mention', value: match[1] ?? '' })
    lastIndex = index + match[0].length
  }
  if (lastIndex < body.length) {
    parts.push({ type: 'text', value: body.slice(lastIndex) })
  }
  return parts.length ? parts : [{ type: 'text', value: body }]
}

/**
 * Active @-mention query at the end of the draft, or null if not mentioning.
 * Empty string means the user typed `@` alone (show everyone + departments).
 */
export function getActiveMentionQuery(text: string): string | null {
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] !== '@') continue
    const prev = i === 0 ? ' ' : text[i - 1]!
    if (i > 0 && !/[\s([{,]/.test(prev)) continue

    const after = text.slice(i)
    if (COMPLETED_MENTION_SUFFIX.test(after)) return null
    if (COMPLETED_MENTION_PREFIX.test(after)) continue

    const query = after.slice(1)
    if (query.startsWith('[')) return null
    return query
  }
  return null
}

/** Replace the active unfinished @query with a formatted mention token. */
export function applyMentionPick(
  text: string,
  displayName: string,
  tokenId: string
): string {
  const token = formatMentionDisplay(displayName, tokenId) + ' '
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] !== '@') continue
    const prev = i === 0 ? ' ' : text[i - 1]!
    if (i > 0 && !/[\s([{,]/.test(prev)) continue
    const after = text.slice(i)
    if (COMPLETED_MENTION_PREFIX.test(after)) continue
    return text.slice(0, i) + token
  }
  return `${text}${token}`
}
