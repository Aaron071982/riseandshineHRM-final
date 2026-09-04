import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma, isPrismaMissingSchemaError } from '@/lib/prisma'
import { validateSession, type SessionUser, isAdmin } from '@/lib/auth'
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
 * HRM admins only, plus break-glass allowlist emails.
 */
export async function canAccessClientServices(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  if (isClientServicesFullAccessEmail(user.email)) return true
  return isAdmin(user)
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

/** Drop every elevated CS session for a user (e.g. on HRM login / logout). */
export async function revokeAllClientServicesElevatedSessions(
  userId: string
): Promise<void> {
  await prisma.clientServicesSession.deleteMany({ where: { userId } }).catch(() => {})
}

/**
 * Elevated CS session is valid when:
 * - absolute age since createdAt is under CS_SESSION_ABSOLUTE_MS, AND
 * - idle time since lastActiveAt is under CS_SESSION_IDLE_MS.
 * Each successful check slides lastActiveAt forward.
 */
export async function validateElevatedSession(
  token: string | undefined | null,
  sessionUser?: SessionUser | null
): Promise<SessionUser | null> {
  if (!token) return null

  let user = sessionUser ?? null
  if (!user) {
    // Read cookies before any other await. Server actions in Next 14 can lose
    // request cookie context after Prisma/network I/O.
    const cookieStore = await cookies()
    const mainToken = cookieStore.get('session')?.value
    if (!mainToken) return null
    user = await validateSession(mainToken)
    if (!user) return null
  }
  if (!(await canAccessClientServices(user))) return null

  let row: {
    id: string
    userId: string
    lastActiveAt: Date
    createdAt: Date
    expiresAt: Date
  }
  try {
    const found = await prisma.clientServicesSession.findUnique({
      where: { token },
    })
    if (!found) return null
    row = found
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      console.warn(
        '[client-services] client_services_sessions schema is behind — run prisma db push.'
      )
      return null
    }
    throw error
  }

  if (user.id !== row.userId) return null

  const now = Date.now()
  const expired = isElevatedSessionExpired({
    nowMs: now,
    lastActiveAtMs: (row.lastActiveAt ?? row.createdAt).getTime(),
    createdAtMs: row.createdAt.getTime(),
    expiresAtMs: row.expiresAt.getTime(),
    idleMs: CS_SESSION_IDLE_MS,
    absoluteMs: CS_SESSION_ABSOLUTE_MS,
  })

  if (expired) {
    await prisma.clientServicesSession.delete({ where: { id: row.id } }).catch(() => {})
    return null
  }

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

/** Mint an elevated CS session after verified login (Microsoft OAuth / OTP). */
export async function grantClientServicesElevatedAccess(input: {
  userId: string
  ip?: string | null
}): Promise<string> {
  const token = await createElevatedSession(input.userId, input.ip)
  await logClientAccess({
    userId: input.userId,
    action: 'SECTION_ENTRY',
    ip: input.ip ?? null,
  })
  return token
}

/** Sync check for layouts — returns user if elevated session is valid. */
export async function getElevatedClientServicesUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const mainToken = cookieStore.get('session')?.value
  const csToken = cookieStore.get(CS_SESSION_COOKIE)?.value
  if (!mainToken || !csToken) return null
  const user = await validateSession(mainToken)
  if (!user) return null
  return validateElevatedSession(csToken, user)
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
  const elevated = await validateElevatedSession(csToken, user)
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

type CsScopedUser = SessionUser & {
  crmRoles?: import('@prisma/client').CrmRole[]
}

async function crmSubject(user: CsScopedUser) {
  const { fetchUserCrmRoles } = await import('@/lib/crm/access')
  const crmRoles = user.crmRoles ?? (await fetchUserCrmRoles(user.id))
  return { ...user, crmRoles }
}

/** Read guard: elevated CS session + claim-scoped view access for one client. */
export async function enforceClientScope(
  user: CsScopedUser,
  _scope: ClientScope,
  clientId: string,
  request?: NextRequest
): Promise<NextResponse | null> {
  const { assertCanViewClient, CrmAccessError } = await import('@/lib/crm/access')
  try {
    await assertCanViewClient(await crmSubject(user), clientId)
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

/** Write guard: elevated CS session + current-dept edit access for one client. */
export async function enforceClientScopeForEdit(
  user: CsScopedUser,
  _scope: ClientScope,
  clientId: string,
  request?: NextRequest
): Promise<NextResponse | null> {
  const { assertCanEditClient, CrmAccessError } = await import('@/lib/crm/access')
  try {
    await assertCanEditClient(await crmSubject(user), clientId)
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
      const message =
        err.status === 403 && err.message.includes('View-only')
          ? err.message
          : 'Forbidden — outside caseload'
      return NextResponse.json({ error: message }, { status: err.status })
    }
    throw err
  }
}

export { isClientServicesFullAccessEmail }
