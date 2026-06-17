import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateClientId, generateClientSecret } from '@/lib/oauth/crypto'
import { validateRedirectUris } from '@/lib/oauth/redirect'
import { logOAuthEvent } from '@/lib/oauth/audit'
import { logOAuthRoute, oauthJsonResponse, oauthOptionsResponse } from '@/lib/oauth/http'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  logOAuthRoute('register', { method: 'OPTIONS' })
  return oauthOptionsResponse()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientName =
      typeof body.client_name === 'string' && body.client_name.trim()
        ? body.client_name.trim()
        : 'Claude MCP Connector'
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
    const grantTypes = Array.isArray(body.grant_types)
      ? body.grant_types
      : ['authorization_code']
    const tokenEndpointAuthMethod =
      typeof body.token_endpoint_auth_method === 'string'
        ? body.token_endpoint_auth_method
        : 'none'

    logOAuthRoute('register', {
      method: 'POST',
      clientName,
      redirectUriCount: redirectUris.length,
      grantTypes,
      tokenEndpointAuthMethod,
    })

    if (redirectUris.length === 0) {
      return oauthJsonResponse(
        { error: 'invalid_client_metadata', error_description: 'redirect_uris is required' },
        400
      )
    }

    const redirectCheck = validateRedirectUris(redirectUris)
    if (!redirectCheck.ok) {
      return oauthJsonResponse(
        { error: 'invalid_redirect_uri', error_description: redirectCheck.error },
        400
      )
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

    logOAuthRoute('register', { method: 'POST', status: 201, clientId })
    return oauthJsonResponse(response, 201)
  } catch (err) {
    console.error('[oauth/register]', err)
    return oauthJsonResponse({ error: 'server_error' }, 500)
  }
}
