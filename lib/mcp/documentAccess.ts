import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import type { DocumentAccessAction } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'
import { requireMcpAuthContext } from '@/lib/mcp/context'

const VIEW_TOKEN_TTL_SECONDS = 5 * 60
const VOLUME_WINDOW_MS = 60 * 60 * 1000
const DEFAULT_READS_PER_HOUR = 20
const DEFAULT_DISTINCT_CLIENTS = 8

function viewTokenSecret(): string {
  return (
    process.env.MCP_DOCUMENT_VIEW_SECRET ||
    process.env.MCP_API_KEY ||
    process.env.NEXTAUTH_SECRET ||
    'mcp-document-view-dev-secret'
  )
}

export type DocumentViewTokenPayload = {
  requirementId: string
  userId: string
  exp: number
}

export function signDocumentViewToken(payload: {
  requirementId: string
  userId: string
  ttlSeconds?: number
}): string {
  const body: DocumentViewTokenPayload = {
    requirementId: payload.requirementId,
    userId: payload.userId,
    exp: Math.floor(Date.now() / 1000) + (payload.ttlSeconds ?? VIEW_TOKEN_TTL_SECONDS),
  }
  const json = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url')
  const mac = createHmac('sha256', viewTokenSecret()).update(json).digest('base64url')
  return `${json}.${mac}`
}

export function verifyDocumentViewToken(token: string): DocumentViewTokenPayload | null {
  const [json, mac] = token.split('.')
  if (!json || !mac) return null
  const expected = createHmac('sha256', viewTokenSecret()).update(json).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(
      Buffer.from(json, 'base64url').toString('utf8')
    ) as DocumentViewTokenPayload
    if (!payload.requirementId || !payload.userId || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function documentViewUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/api/mcp/document-view?t=${encodeURIComponent(token)}`
}

export async function logDocumentAccess(input: {
  userId?: string | null
  serviceClientId?: string | null
  documentId: string
  documentType: string
  action: DocumentAccessAction
  mode?: string | null
  reason?: string | null
}): Promise<void> {
  const auth = (() => {
    try {
      return requireMcpAuthContext()
    } catch {
      return null
    }
  })()

  const userId = input.userId || auth?.userId || (await getMcpSystemUserId())

  await prisma.documentAccessLog.create({
    data: {
      userId,
      serviceClientId: input.serviceClientId ?? null,
      documentId: input.documentId,
      documentType: input.documentType,
      action: input.action,
      mode: input.mode ?? null,
      oauthClientId: auth?.clientId ?? null,
      tokenHashPrefix: auth?.tokenHash?.slice(0, 8) ?? null,
      ip: auth?.requestIp ?? null,
      reason: input.reason ?? null,
    },
  })

  if (input.action === 'BLOCKED_TYPE' || input.action === 'BLOCKED_UNAUTHORIZED') {
    await notifyAdminsOfDocumentEvent({
      kind: 'blocked',
      action: input.action,
      documentType: input.documentType,
      userId,
    })
  } else {
    await maybeNotifyVolume(userId)
  }
}

async function notifyAdminsOfDocumentEvent(input: {
  kind: 'blocked' | 'volume'
  action?: DocumentAccessAction
  documentType?: string
  userId: string
  extra?: string
}) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
    take: 20,
  })
  if (admins.length === 0) return

  const message =
    input.kind === 'blocked'
      ? `MCP document access blocked (${input.action}): type=${input.documentType ?? 'unknown'} actor=${input.userId}`
      : `MCP document access volume alert: ${input.extra ?? ''} actor=${input.userId}`

  await prisma.adminNotification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: 'MCP_DOCUMENT_ACCESS',
      message,
      linkUrl: '/admin/mcp-document-access',
    })),
  })
}

async function maybeNotifyVolume(userId: string) {
  const readsPerHour = Number(process.env.MCP_DOC_ALERT_READS_PER_HOUR) || DEFAULT_READS_PER_HOUR
  const distinctClients =
    Number(process.env.MCP_DOC_ALERT_DISTINCT_CLIENTS) || DEFAULT_DISTINCT_CLIENTS
  const since = new Date(Date.now() - VOLUME_WINDOW_MS)

  const recent = await prisma.documentAccessLog.findMany({
    where: {
      createdAt: { gte: since },
      action: { in: ['LINK_ISSUED', 'TEXT_RETURNED'] },
    },
    select: { serviceClientId: true },
  })

  const clientIds = new Set(
    recent.map((r) => r.serviceClientId).filter((id): id is string => Boolean(id))
  )

  if (recent.length === readsPerHour + 1 || clientIds.size === distinctClients + 1) {
    await notifyAdminsOfDocumentEvent({
      kind: 'volume',
      userId,
      extra: `${recent.length} reads / ${clientIds.size} clients in 1h (thresholds ${readsPerHour}/${distinctClients})`,
    })
  }
}

export { VIEW_TOKEN_TTL_SECONDS }
