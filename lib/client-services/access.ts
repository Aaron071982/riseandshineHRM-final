import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession, type SessionUser } from '@/lib/auth'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  CS_SESSION_COOKIE,
  CS_SESSION_DURATION_MS,
  isClientServicesFullAccessEmail,
} from '@/lib/client-services/constants'
import { logClientAccess } from '@/lib/client-services/audit'

export type ClientScope = 'ALL' | { clientIds: string[] }

/**
 * Whether the user may enter Client Services at all (before step-up).
 * Allowlist + jaden/azm email substrings.
 */
export async function canAccessClientServices(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  return isClientServicesFullAccessEmail(user.email)
}

/**
 * Scope for list/detail queries.
 * Allowlisted users → full caseload ('ALL').
 */
export async function getClientScopeForUser(user: SessionUser): Promise<ClientScope> {
  if (isClientServicesFullAccessEmail(user.email)) {
    return 'ALL'
  }
  return { clientIds: [] }
}

export function scopeAllowsClient(scope: ClientScope, clientId: string): boolean {
  if (scope === 'ALL') return true
  return scope.clientIds.includes(clientId)
}

export async function createElevatedSession(
  userId: string,
  ipAddress?: string | null
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + CS_SESSION_DURATION_MS)

  await prisma.clientServicesSession.deleteMany({
    where: {
      userId,
      expiresAt: { lt: new Date() },
    },
  })

  await prisma.clientServicesSession.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: ipAddress ?? null,
    },
  })

  return token
}

export async function validateElevatedSession(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) return null
  const row = await prisma.clientServicesSession.findUnique({
    where: { token },
  })
  if (!row || row.expiresAt < new Date()) {
    if (row) {
      await prisma.clientServicesSession.delete({ where: { id: row.id } }).catch(() => {})
    }
    return null
  }

  const cookieStore = await cookies()
  const mainToken = cookieStore.get('session')?.value
  if (!mainToken) return null
  const user = await validateSession(mainToken)
  if (!user || user.id !== row.userId) return null
  if (!(await canAccessClientServices(user))) return null
  return user
}

export function setElevatedSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(CS_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(CS_SESSION_DURATION_MS / 1000),
    path: '/',
  })
}

export function clearElevatedSessionCookie(response: NextResponse): void {
  response.cookies.set(CS_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

/** Sync check for layouts — returns user if elevated session is valid. */
export async function getElevatedClientServicesUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const csToken = cookieStore.get(CS_SESSION_COOKIE)?.value
  return validateElevatedSession(csToken)
}

/**
 * API guard: main session + canAccess + elevated cs_session.
 */
export async function requireClientServicesSession(): Promise<
  | { user: SessionUser; scope: ClientScope; response: null }
  | { user: null; scope: null; response: NextResponse }
> {
  const cookieStore = await cookies()
  const mainToken = cookieStore.get('session')?.value
  if (!mainToken) {
    return {
      user: null,
      scope: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const user = await validateSession(mainToken)
  if (!user) {
    return {
      user: null,
      scope: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  if (!(await canAccessClientServices(user))) {
    return {
      user: null,
      scope: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const csToken = cookieStore.get(CS_SESSION_COOKIE)?.value
  const elevated = await validateElevatedSession(csToken)
  if (!elevated) {
    return {
      user: null,
      scope: null,
      response: NextResponse.json(
        { error: 'Client Services step-up required', code: 'CS_STEP_UP_REQUIRED' },
        { status: 401 }
      ),
    }
  }

  const scope = await getClientScopeForUser(user)
  return { user, scope, response: null }
}

/** Main session + allowlist only (for elevate OTP send/verify before elevated cookie exists). */
export async function requireClientServicesEligibleSession(): Promise<
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse }
> {
  const cookieStore = await cookies()
  const mainToken = cookieStore.get('session')?.value
  if (!mainToken) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await validateSession(mainToken)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!(await canAccessClientServices(user))) {
    return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, response: null }
}

export async function enforceClientScope(
  user: SessionUser,
  scope: ClientScope,
  clientId: string,
  request?: NextRequest
): Promise<NextResponse | null> {
  if (scopeAllowsClient(scope, clientId)) return null
  const ip = request ? getClientIpFromRequest(request) : null
  await logClientAccess({
    userId: user.id,
    serviceClientId: clientId,
    action: 'ACCESS_VIOLATION',
    ip,
  })
  return NextResponse.json({ error: 'Forbidden — outside caseload' }, { status: 403 })
}

export { isClientServicesFullAccessEmail }
