import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { getPostLoginPath, normalizeLoginRole } from '@/lib/auth/postLogin'
import {
  MICROSOFT_GRAPH_TOKEN_COOKIE,
  MICROSOFT_NONCE_COOKIE,
  MICROSOFT_PKCE_COOKIE,
  MICROSOFT_STATE_COOKIE,
  decodeMicrosoftIdTokenClaims,
  getMicrosoftAuthorityBase,
  getMicrosoftClientId,
  getMicrosoftClientSecret,
  getMicrosoftRedirectUri,
  getMicrosoftTenantId,
  isRiseAndShineOrgEmail,
  microsoftAuthEnabled,
  normalizeMicrosoftEmail,
} from '@/lib/auth/microsoft'
import { bootstrapCrmSuperAdmins } from '@/lib/crm/bootstrapRoles'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const UNAUTHORIZED_MSG =
  'Microsoft account not authorized. Use your @riseandshineaba.com work account in the Rise & Shine tenant.'

function deny(request: NextRequest, message: string): NextResponse {
  const url = new URL('/login', request.url)
  url.searchParams.set('session_error', '1')
  url.searchParams.set('reason', message)
  return NextResponse.redirect(url, { status: 302 })
}

export async function GET(request: NextRequest) {
  if (!microsoftAuthEnabled()) return deny(request, 'Microsoft sign-in is disabled')

  const tenantId = getMicrosoftTenantId()
  const clientId = getMicrosoftClientId()
  const clientSecret = getMicrosoftClientSecret()
  if (!tenantId || !clientId || !clientSecret) {
    return deny(request, 'Microsoft sign-in is not configured')
  }

  const sp = request.nextUrl.searchParams
  const code = sp.get('code') ?? ''
  const state = sp.get('state') ?? ''
  const oauthError = sp.get('error')
  if (oauthError) return deny(request, `Microsoft OAuth error: ${oauthError}`)
  if (!code || !state) return deny(request, 'Missing OAuth callback parameters')

  const cookieState = request.cookies.get(MICROSOFT_STATE_COOKIE)?.value ?? ''
  const verifier = request.cookies.get(MICROSOFT_PKCE_COOKIE)?.value ?? ''
  const nonce = request.cookies.get(MICROSOFT_NONCE_COOKIE)?.value ?? ''
  if (!cookieState || state !== cookieState || !verifier || !nonce) {
    return deny(request, 'Invalid login state, please try again')
  }

  const redirectUri = getMicrosoftRedirectUri(request.nextUrl.origin)
  const tokenRes = await fetch(`${getMicrosoftAuthorityBase(tenantId)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => '')
    console.error('[auth][microsoft] token exchange failed', tokenRes.status, detail.slice(0, 200))
    return deny(request, 'Microsoft token exchange failed')
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string
    id_token?: string
    expires_in?: number
  }
  const accessToken = tokenJson.access_token ?? ''
  const idToken = tokenJson.id_token ?? ''
  if (!accessToken || !idToken) return deny(request, 'Missing Microsoft token payload')

  const claims = decodeMicrosoftIdTokenClaims(idToken)
  if (!claims) return deny(request, 'Invalid Microsoft identity token')
  if ((claims.tid ?? '') !== tenantId) return deny(request, UNAUTHORIZED_MSG)
  if ((claims.nonce ?? '') !== nonce) return deny(request, 'Invalid Microsoft nonce')

  const email = normalizeMicrosoftEmail(claims)
  if (!email || !isRiseAndShineOrgEmail(email)) {
    return deny(request, UNAUTHORIZED_MSG)
  }

  const displayName = claims.name?.trim() || email.split('@')[0]
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, role: true, isActive: true },
  })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: displayName,
        role: 'ADMIN',
        isActive: true,
      },
      select: { id: true, role: true, isActive: true },
    })
  } else if (!user.isActive) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, name: displayName },
      select: { id: true, role: true, isActive: true },
    })
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: displayName },
    })
  }

  await bootstrapCrmSuperAdmins(user.id).catch((err) => {
    console.warn('[auth][microsoft] bootstrapCrmSuperAdmins failed', err)
  })

  const sessionToken = await createSession(user.id, {
    device: 'OAuth',
    browser: request.headers.get('user-agent') || null,
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null,
  })

  const loginRole = normalizeLoginRole(user.role)
  const redirectTo = getPostLoginPath(loginRole) ?? '/admin/dashboard'
  const response = NextResponse.redirect(new URL(redirectTo, request.url), { status: 302 })
  const secure = process.env.NODE_ENV === 'production'

  response.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })
  response.cookies.set(MICROSOFT_GRAPH_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: Math.max(60, Number(tokenJson.expires_in ?? 3600)),
    path: '/',
  })
  response.cookies.delete(MICROSOFT_PKCE_COOKIE)
  response.cookies.delete(MICROSOFT_STATE_COOKIE)
  response.cookies.delete(MICROSOFT_NONCE_COOKIE)
  return response
}
