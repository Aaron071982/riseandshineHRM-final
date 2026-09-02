import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getToolAccessRule } from '@/lib/mcp/scopes'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'

export type McpToolCallLogInput = {
  toolName: string
  args: Record<string, unknown>
  resultSummary: Record<string, unknown>
  authMethod?: 'oauth' | 'api_key'
  clientId?: string
  tokenHashPrefix?: string
}

const CLIENT_ID_KEYS = new Set([
  'clientId',
  'client_id',
  'serviceClientId',
  'service_client_id',
])

const PHI_STRING_KEYS = new Set([
  'query',
  'note',
  'address',
  'addressLine',
  'email',
  'phone',
  'parentEmail',
  'parentPhone',
  'parent_email',
  'parent_phone',
])

function looksLikeEmail(value: string): boolean {
  return value.includes('@')
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10
}

function sanitizeScalar(key: string, value: unknown): unknown {
  if (CLIENT_ID_KEYS.has(key) && typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (typeof value === 'string') {
    if (key === 'note') return `[${value.length} chars]`
    if (PHI_STRING_KEYS.has(key)) {
      if (looksLikeEmail(value)) return '[email redacted]'
      if (looksLikePhone(value)) return '[phone redacted]'
      if (key === 'query') {
        return value.includes('@') ? '[email query]' : `[query: ${value.length} chars]`
      }
      return `[${key}: ${value.length} chars]`
    }
  }

  return value
}

export function sanitizeMcpArgs(
  args: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeMcpArgs(value as Record<string, unknown>)
      continue
    }
    sanitized[key] = sanitizeScalar(key, value)
  }
  return sanitized
}

function extractClientIdReference(
  args: Record<string, unknown>
): string | undefined {
  for (const key of CLIENT_ID_KEYS) {
    const value = args[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  if (typeof args.client === 'string' && args.client.trim()) {
    return args.client.trim()
  }
  return undefined
}

export async function logMcpToolCall(input: McpToolCallLogInput): Promise<void> {
  try {
    const userId = await getMcpSystemUserId()
    const accessRule = getToolAccessRule(input.toolName)
    const phiAccess = accessRule.requiresPhi
    const clientRef =
      extractClientIdReference(input.args) ??
      (typeof input.clientId === 'string' ? input.clientId : undefined)

    await prisma.activityLog.create({
      data: {
        userId,
        activityType: 'MCP_TOOL_CALL',
        action: input.toolName,
        resourceType: phiAccess ? 'MCP_PHI' : 'MCP',
        resourceId: clientRef ?? input.toolName,
        metadata: {
          args: sanitizeMcpArgs(input.args),
          resultSummary: input.resultSummary,
          phiAccess,
          authMethod: input.authMethod ?? null,
          oauthClientId: input.clientId ?? null,
          tokenHashPrefix: input.tokenHashPrefix ?? null,
          clientIdRef: clientRef ?? null,
        } as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.error('[mcp-audit] Failed to log tool call:', err)
  }
}
