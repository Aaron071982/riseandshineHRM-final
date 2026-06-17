import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateSecureToken,
  hashToken,
  verifyPkce,
} from '@/lib/oauth/crypto'
import { logOAuthEvent } from '@/lib/oauth/audit'
import { logOAuthRoute, oauthJsonResponse, oauthOptionsResponse } from '@/lib/oauth/http'

export const dynamic = 'force-dynamic'

async function parseTokenBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => ({}))
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  }
  const text = await request.text()
  const params = new URLSearchParams(text)
  const out: Record<string, string> = {}
  for (const [k, v] of params.entries()) out[k] = v
  return out
}

export async function OPTIONS() {
  logOAuthRoute('token', { method: 'OPTIONS' })
  return oauthOptionsResponse()
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseTokenBody(request)
    const grantType = body.grant_type

    logOAuthRoute('token', {
      method: 'POST',
      grantType,
      clientId: body.client_id ?? null,
      hasCode: !!body.code,
      hasVerifier: !!body.code_verifier,
    })

    if (grantType !== 'authorization_code') {
      return oauthJsonResponse({ error: 'unsupported_grant_type' }, 400)
    }

    const code = body.code
    const clientId = body.client_id
    const redirectUri = body.redirect_uri
    const codeVerifier = body.code_verifier

    if (!code || !clientId || !redirectUri || !codeVerifier) {
      return oauthJsonResponse({ error: 'invalid_request' }, 400)
    }

    const client = await prisma.oAuthClient.findUnique({ where: { id: clientId } })
    if (!client) {
      return oauthJsonResponse({ error: 'invalid_client' }, 401)
    }

    if (client.clientSecret) {
      const providedSecret = body.client_secret ?? ''
      if (providedSecret !== client.clientSecret) {
        return oauthJsonResponse({ error: 'invalid_client' }, 401)
      }
    }

    const authCode = await prisma.oAuthAuthorizationCode.findUnique({ where: { id: code } })
    if (!authCode || authCode.clientId !== clientId) {
      return oauthJsonResponse({ error: 'invalid_grant' }, 400)
    }
    if (authCode.used) {
      return oauthJsonResponse(
        { error: 'invalid_grant', error_description: 'code already used' },
        400
      )
    }
    if (authCode.expiresAt < new Date()) {
      return oauthJsonResponse(
        { error: 'invalid_grant', error_description: 'code expired' },
        400
      )
    }
    if (authCode.redirectUri !== redirectUri) {
      return oauthJsonResponse(
        { error: 'invalid_grant', error_description: 'redirect_uri mismatch' },
        400
      )
    }
    if (authCode.codeChallengeMethod !== 'S256') {
      return oauthJsonResponse({ error: 'invalid_grant' }, 400)
    }
    if (!verifyPkce(codeVerifier, authCode.codeChallenge)) {
      return oauthJsonResponse(
        { error: 'invalid_grant', error_description: 'PKCE verification failed' },
        400
      )
    }

    await prisma.oAuthAuthorizationCode.update({
      where: { id: code },
      data: { used: true },
    })

    const accessToken = generateSecureToken(32)
    const tokenHash = hashToken(accessToken)
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000)

    await prisma.oAuthAccessToken.create({
      data: {
        id: tokenHash,
        clientId,
        scope: authCode.scope,
        expiresAt,
      },
    })

    await logOAuthEvent('OAUTH_TOKEN_ISSUED', {
      clientId,
      scope: authCode.scope,
      tokenIdPrefix: tokenHash.slice(0, 8),
      approvedByUserId: authCode.approvedByUserId,
    })

    logOAuthRoute('token', { method: 'POST', status: 200, clientId })

    return oauthJsonResponse({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: authCode.scope,
    })
  } catch (err) {
    console.error('[oauth/token]', err)
    return oauthJsonResponse({ error: 'server_error' }, 500)
  }
}
