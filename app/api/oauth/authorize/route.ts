import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import {
  AUTH_CODE_TTL_SECONDS,
  generateSecureToken,
  MCP_OAUTH_SCOPE,
} from '@/lib/oauth/crypto'
import { clientAllowsRedirectUri } from '@/lib/oauth/redirect'
import { logOAuthEvent } from '@/lib/oauth/audit'
import { logOAuthRoute } from '@/lib/oauth/http'

export const dynamic = 'force-dynamic'

type AuthorizeParams = {
  clientId: string
  redirectUri: string
  responseType: string
  scope: string
  state: string
  codeChallenge: string
  codeChallengeMethod: string
}

function parseAuthorizeParams(request: NextRequest): AuthorizeParams | { error: string } {
  const sp = request.nextUrl.searchParams
  const clientId = sp.get('client_id') ?? ''
  const redirectUri = sp.get('redirect_uri') ?? ''
  const responseType = sp.get('response_type') ?? ''
  const scope = sp.get('scope') ?? MCP_OAUTH_SCOPE
  const state = sp.get('state') ?? ''
  const codeChallenge = sp.get('code_challenge') ?? ''
  const codeChallengeMethod = sp.get('code_challenge_method') ?? ''

  if (!clientId) return { error: 'client_id is required' }
  if (!redirectUri) return { error: 'redirect_uri is required' }
  if (responseType !== 'code') return { error: 'response_type must be code' }
  if (!codeChallenge) return { error: 'code_challenge is required (PKCE)' }
  if (codeChallengeMethod !== 'S256') return { error: 'code_challenge_method must be S256' }

  return { clientId, redirectUri, responseType, scope, state, codeChallenge, codeChallengeMethod }
}

function buildRedirect(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }
  return url.toString()
}

/** OAuth callback redirects must use 303 so the browser follows with GET (not POST). */
function redirectToClient(redirectUrl: string): NextResponse {
  return NextResponse.redirect(redirectUrl, { status: 303 })
}

function consentHtml(params: AuthorizeParams, clientName: string): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: params.responseType,
    scope: params.scope,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
  })
  const scopes = params.scope.split(/\s+/).filter(Boolean)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize Claude — Rise &amp; Shine HRM</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 48px auto; padding: 0 16px; color: #111; }
    h1 { font-size: 1.25rem; margin-bottom: 8px; }
    p { color: #444; line-height: 1.5; }
    ul { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button { flex: 1; padding: 12px 16px; border-radius: 8px; font-size: 1rem; cursor: pointer; border: none; }
    .approve { background: #e36f1e; color: #fff; }
    .deny { background: #f3f4f6; color: #111; border: 1px solid #d1d5db; }
  </style>
</head>
<body>
  <h1>Authorize Claude</h1>
  <p><strong>${escapeHtml(clientName)}</strong> is requesting access to your Rise &amp; Shine HRM.</p>
  <p>This will allow Claude to:</p>
  <ul>
    <li>Read HRM data (onboarding status, pipeline stats, BT lookups)</li>
    <li>Add internal notes to profiles (only after you confirm each note)</li>
  </ul>
  <p>Scopes: ${escapeHtml(scopes.join(', ') || MCP_OAUTH_SCOPE)}</p>
  <form method="post" action="/api/oauth/authorize?${q.toString()}">
    <div class="actions">
      <button type="submit" name="decision" value="approve" class="approve">Approve</button>
      <button type="submit" name="decision" value="deny" class="deny">Deny</button>
    </div>
  </form>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui;max-width:480px;margin:48px auto;padding:16px"><h1>Authorization denied</h1><p>${escapeHtml(message)}</p></body></html>`
}

async function validateClientAndRedirect(params: AuthorizeParams) {
  const client = await prisma.oAuthClient.findUnique({ where: { id: params.clientId } })
  if (!client) return { error: 'invalid_client' as const }
  if (!clientAllowsRedirectUri(client.redirectUris, params.redirectUri)) {
    return { error: 'invalid_redirect_uri' as const }
  }
  return { client }
}

export async function GET(request: NextRequest) {
  logOAuthRoute('authorize', {
    method: 'GET',
    clientId: request.nextUrl.searchParams.get('client_id'),
    hasChallenge: !!request.nextUrl.searchParams.get('code_challenge'),
  })
  const parsed = parseAuthorizeParams(request)
  if ('error' in parsed) {
    return new NextResponse(errorHtml(parsed.error), { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  const validated = await validateClientAndRedirect(parsed)
  if ('error' in validated) {
    return new NextResponse(errorHtml('Invalid client or redirect URI.'), { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  const user = await getCurrentUser()
  if (!user) {
    const returnUrl = request.nextUrl.pathname + request.nextUrl.search
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnUrl', returnUrl)
    return NextResponse.redirect(loginUrl)
  }

  if (!isAdmin(user)) {
    return new NextResponse(errorHtml('Only Rise & Shine admins can authorize this connection.'), {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new NextResponse(consentHtml(parsed, validated.client.clientName), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function POST(request: NextRequest) {
  logOAuthRoute('authorize', {
    method: 'POST',
    clientId: request.nextUrl.searchParams.get('client_id'),
  })
  const parsed = parseAuthorizeParams(request)
  if ('error' in parsed) {
    return new NextResponse(errorHtml(parsed.error), { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  const validated = await validateClientAndRedirect(parsed)
  if ('error' in validated) {
    return new NextResponse(errorHtml('Invalid client or redirect URI.'), { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  const user = await getCurrentUser()
  if (!user) {
    const returnUrl = request.nextUrl.pathname + request.nextUrl.search
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnUrl', returnUrl)
    return NextResponse.redirect(loginUrl)
  }

  if (!isAdmin(user)) {
    return new NextResponse(errorHtml('Only Rise & Shine admins can authorize this connection.'), {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const form = await request.formData()
  const decision = form.get('decision')?.toString() ?? 'deny'

  if (decision !== 'approve') {
    const redirect = buildRedirect(parsed.redirectUri, {
      error: 'access_denied',
      state: parsed.state,
    })
    logOAuthRoute('authorize', { method: 'POST', outcome: 'deny', status: 303 })
    return redirectToClient(redirect)
  }

  const code = generateSecureToken(32)
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000)

  await prisma.oAuthAuthorizationCode.create({
    data: {
      id: code,
      clientId: parsed.clientId,
      redirectUri: parsed.redirectUri,
      codeChallenge: parsed.codeChallenge,
      codeChallengeMethod: parsed.codeChallengeMethod,
      scope: parsed.scope || MCP_OAUTH_SCOPE,
      expiresAt,
      approvedByUserId: user.id,
    },
  })

  await logOAuthEvent(
    'OAUTH_AUTHORIZATION_APPROVED',
    { clientId: parsed.clientId, scope: parsed.scope },
    user.id
  )

  const redirect = buildRedirect(parsed.redirectUri, {
    code,
    state: parsed.state,
  })
  logOAuthRoute('authorize', { method: 'POST', outcome: 'approve', status: 303 })
  return redirectToClient(redirect)
}
