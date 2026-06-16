import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logOAuthEvent } from '@/lib/oauth/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const now = new Date()
  const tokens = await prisma.oAuthAccessToken.findMany({
    where: {
      revokedAt: null,
      expiresAt: { gt: now },
    },
    include: { client: { select: { clientName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    items: tokens.map((t) => ({
      id: t.id,
      clientId: t.clientId,
      clientName: t.client.clientName,
      scope: t.scope,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const action = body.action as string | undefined

  if (action === 'revoke_all') {
    const result = await prisma.oAuthAccessToken.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await logOAuthEvent('OAUTH_TOKEN_REVOKED_ALL', { count: result.count }, auth.user.id)
    return NextResponse.json({ success: true, revoked: result.count })
  }

  const tokenId = typeof body.tokenId === 'string' ? body.tokenId : ''
  if (!tokenId) {
    return NextResponse.json({ error: 'tokenId required' }, { status: 400 })
  }

  const token = await prisma.oAuthAccessToken.findUnique({ where: { id: tokenId } })
  if (!token) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  await prisma.oAuthAccessToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  })

  await logOAuthEvent('OAUTH_TOKEN_REVOKED', { tokenIdPrefix: tokenId.slice(0, 8), clientId: token.clientId }, auth.user.id)

  return NextResponse.json({ success: true })
}
