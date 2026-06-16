import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/oauth/crypto'

/**
 * MCP connector auth: OAuth 2.0 Bearer access token (primary) or static MCP_API_KEY (dev/testing fallback).
 */
export async function assertMcpAuth(request: NextRequest): Promise<NextResponse | null> {
  const MCP_API_KEY = process.env.MCP_API_KEY
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? ''

  if (!bearerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (MCP_API_KEY && bearerToken === MCP_API_KEY) {
    return null
  }

  const tokenHash = hashToken(bearerToken)
  const record = await prisma.oAuthAccessToken.findUnique({
    where: { id: tokenHash },
    select: { id: true, expiresAt: true, revokedAt: true },
  })

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  prisma.oAuthAccessToken
    .update({ where: { id: tokenHash }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return null
}
