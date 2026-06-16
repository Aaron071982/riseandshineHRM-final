import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateClientId, generateClientSecret } from '@/lib/oauth/crypto'
import { validateRedirectUris } from '@/lib/oauth/redirect'
import { logOAuthEvent } from '@/lib/oauth/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : ''
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
    const grantTypes = Array.isArray(body.grant_types)
      ? body.grant_types
      : ['authorization_code']
    const tokenEndpointAuthMethod =
      typeof body.token_endpoint_auth_method === 'string'
        ? body.token_endpoint_auth_method
        : 'none'

    if (!clientName) {
      return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'client_name required' }, { status: 400 })
    }

    const redirectCheck = validateRedirectUris(redirectUris)
    if (!redirectCheck.ok) {
      return NextResponse.json({ error: 'invalid_redirect_uri', error_description: redirectCheck.error }, { status: 400 })
    }

    const clientId = generateClientId()
    const isConfidential = tokenEndpointAuthMethod === 'client_secret_post'
    const clientSecret = isConfidential ? generateClientSecret() : null

    await prisma.oAuthClient.create({
      data: {
        id: clientId,
        clientSecret,
        clientName,
        redirectUris,
        grantTypes,
      },
    })

    await logOAuthEvent('OAUTH_CLIENT_REGISTERED', {
      clientId,
      clientName,
      redirectUriCount: redirectUris.length,
    })

    const issuedAt = Math.floor(Date.now() / 1000)
    const response: Record<string, unknown> = {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      client_name: clientName,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
    }
    if (clientSecret) {
      response.client_secret = clientSecret
    }

    return NextResponse.json(response, { status: 201 })
  } catch (err) {
    console.error('[oauth/register]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
