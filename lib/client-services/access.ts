import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession, type SessionUser } from '@/lib/auth'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  CS_SESSION_ABSOLUTE_MS,
  CS_SESSION_COOKIE,
  CS_SESSION_IDLE_MS,
  isClientServicesFullAccessEmail,
} from '@/lib/client-services/constants'
import { logClientAccess } from '@/lib/client-services/audit'
import { isElevatedSessionExpired } from '@/lib/client-services/sessionExpiry'

export type ClientScope = 'ALL' | { clientIds: string[] }

/**
 * Whether the user may enter Client Services at all (before step-up).
 * Allowlist break-glass OR any active CRM role.
 */
export async function canAccessClientServices(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  if (isClientServicesFullAccessEmail(user.email)) return true
  const { fetchUserCrmRoles } = await import('@/lib/crm/access')
  const roles = await fetchUserCrmRoles(user.id)
  return roles.length > 0
}

/**
 * Scope for list/detail queries.
 * Prefer getVisibleClientsWhere from lib/crm/access for Prisma filters.
 */
export async function getClientScopeForUser(user: SessionUser): Promise<ClientScope> {
  const { fetchUserCrmRoles, isFullAccess } = await import('@/lib/crm/access')
  const crmRoles = await fetchUserCrmRoles(user.id)
  if (isFullAccess({ id: user.id, email: user.email, crmRoles })) {
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
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CS_SESSION_ABSOLUTE_MS)

  await prisma.clientServicesSession.deleteMany({
    where: {
      userId,
      expiresAt: { lt: now },
    },
  })

  await prisma.clientServicesSession.create({
    data: {
      userId,
      token,
      expiresAt,
      lastActiveAt: now,
      ipAddress: ipAddress ?? null,
    },
  })

  return token
}

/**
 * Elevated CS session is valid when:
 * - absolute age since createdAt is under CS_SESSION_ABSOLUTE_MS, AND
 * - idle time since lastActiveAt is under CS_SESSION_IDLE_MS.
 * Each successful check slides lastActiveAt forward.
 */
export async function validateElevatedSession(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) return null
  const row = await prisma.clientServicesSession.findUnique({
    where: { token },
  })
  if (!row) return null

  const now = Date.now()
  const expired = isElevatedSessionExpired({
    nowMs: now,
    lastActiveAtMs: row.lastActiveAt.getTime(),
    createdAtMs: row.createdAt.getTime(),
    expiresAtMs: row.expiresAt.getTime(),
    idleMs: CS_SESSION_IDLE_MS,
    absoluteMs: CS_SESSION_ABSOLUTE_MS,
  })

  if (expired) {
    await prisma.clientServicesSession.delete({ where: { id: row.id } }).catch(() => {})
    return null
  }

  const cookieStore = await cookies()
  const mainToken = cookieStore.get('session')?.value
  if (!mainToken) return null
  const user = await validateSession(mainToken)
  if (!user || user.id !== row.userId) return null
  if (!(await canAccessClientServices(user))) return null

  // Sliding idle window — DB is the source of truth (not cookie maxAge).
  await prisma.clientServicesSession
    .update({
      where: { id: row.id },
      data: { lastActiveAt: new Date(now) },
    })
    .catch(() => {})

  return user
}

export function setElevatedSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(CS_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Cookie outlives the idle window; idle/absolute expiry is enforced in DB.
    maxAge: Math.floor(CS_SESSION_ABSOLUTE_MS / 1000),
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
 * Attaches active `crmRoles` for the access seam.
 */
export async function requireClientServicesSession(): Promise<
  | {
      user: SessionUser & { crmRoles: import('@prisma/client').CrmRole[] }
      scope: ClientScope
      response: null
    }
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
  const { fetchUserCrmRoles } = await import('@/lib/crm/access')
  const crmRoles = await fetchUserCrmRoles(elevated.id)
  return {
    user: { ...elevated, crmRoles },
    scope,
    response: null,
  }
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
  _scope: ClientScope,
  clientId: string,
  request?: NextRequest
): Promise<NextResponse | null> {
  // Delegate to CRM access seam (full-access vs department / coordinator scoping).
  const { assertCanViewClient, CrmAccessError, fetchUserCrmRoles } = await import(
    '@/lib/crm/access'
  )
  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    await assertCanViewClient({ ...user, crmRoles }, clientId)
    return null
  } catch (err) {
    if (err instanceof CrmAccessError) {
      const ip = request ? getClientIpFromRequest(request) : null
      await logClientAccess({
        userId: user.id,
        serviceClientId: clientId,
        action: 'ACCESS_VIOLATION',
        ip,
      })
      return NextResponse.json({ error: 'Forbidden — outside caseload' }, { status: 403 })
    }
    throw err
  }
}

export { isClientServicesFullAccessEmail }
