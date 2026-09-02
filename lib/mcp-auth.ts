import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  MCP_API_KEY_SCOPES,
  parseOAuthScopes,
} from '@/lib/mcp/scopes'
import { hashToken } from '@/lib/oauth/crypto'
import { mcpUnauthorizedResponse } from '@/lib/oauth/http'

export type McpAuthMethod = 'oauth' | 'api_key'

export type McpAuthContext = {
  method: McpAuthMethod
  scopes: Set<string>
  tokenHash?: string
  clientId?: string
}

/**
 * MCP connector auth: OAuth 2.0 Bearer access token (primary) or static MCP_API_KEY
 * (dev/testing fallback — HR tools only, never PHI).
 */
export async function resolveMcpAuth(
  request: NextRequest
): Promise<{ context: McpAuthContext } | { error: NextResponse }> {
  const MCP_API_KEY = process.env.MCP_API_KEY
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? ''

  if (!bearerToken) {
    return { error: mcpUnauthorizedResponse('missing_bearer_token') }
  }

  if (MCP_API_KEY && bearerToken === MCP_API_KEY) {
    return {
      context: {
        method: 'api_key',
        scopes: new Set(MCP_API_KEY_SCOPES),
      },
    }
  }

  const tokenHash = hashToken(bearerToken)
  const record = await prisma.oAuthAccessToken.findUnique({
    where: { id: tokenHash },
    select: {
      id: true,
      clientId: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
    },
  })

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    return { error: mcpUnauthorizedResponse('invalid_or_expired_token') }
  }

  prisma.oAuthAccessToken
    .update({ where: { id: tokenHash }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return {
    context: {
      method: 'oauth',
      scopes: parseOAuthScopes(record.scope),
      tokenHash: record.id,
      clientId: record.clientId,
    },
  }
}

/** @deprecated Use resolveMcpAuth — kept for security audit script compatibility. */
export async function assertMcpAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const result = await resolveMcpAuth(request)
  if ('error' in result) return result.error
  return null
}
