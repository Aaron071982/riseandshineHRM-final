import { NextRequest, NextResponse } from 'next/server'
import {
  MICROSOFT_NONCE_COOKIE,
  MICROSOFT_PKCE_COOKIE,
  MICROSOFT_STATE_COOKIE,
  generateNonce,
  generateOAuthState,
  generatePkceChallenge,
  generatePkceVerifier,
  getMicrosoftAuthorityBase,
  getMicrosoftClientId,
  getMicrosoftRedirectUri,
  getMicrosoftScopes,
  getMicrosoftTenantId,
  microsoftAuthEnabled,
} from '@/lib/auth/microsoft'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!microsoftAuthEnabled()) {
    return NextResponse.json({ error: 'Microsoft sign-in is disabled' }, { status: 404 })
  }

  const tenantId = getMicrosoftTenantId()
  const clientId = getMicrosoftClientId()
  if (!tenantId || !clientId) {
    return NextResponse.json({ error: 'Microsoft auth is not configured' }, { status: 503 })
  }

  const verifier = generatePkceVerifier()
  const challenge = generatePkceChallenge(verifier)
  const state = generateOAuthState()
  const nonce = generateNonce()

  const redirectUri = getMicrosoftRedirectUri(request.nextUrl.origin)
  const authUrl = new URL(`${getMicrosoftAuthorityBase(tenantId)}/authorize`)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_mode', 'query')
  authUrl.searchParams.set('scope', getMicrosoftScopes().join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('nonce', nonce)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  const response = NextResponse.redirect(authUrl, { status: 302 })
  const secure = process.env.NODE_ENV === 'production'
  const cookieOptions = {
    httpOnly: true as const,
    secure,
    sameSite: 'lax' as const,
    maxAge: 10 * 60,
    path: '/',
  }
  response.cookies.set(MICROSOFT_PKCE_COOKIE, verifier, cookieOptions)
  response.cookies.set(MICROSOFT_STATE_COOKIE, state, cookieOptions)
  response.cookies.set(MICROSOFT_NONCE_COOKIE, nonce, cookieOptions)
  return response
}
