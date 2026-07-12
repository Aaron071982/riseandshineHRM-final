import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import crypto from 'crypto'
import { isBillingManagerEmail } from './constants'

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

/** Matches Prisma UserRole so session and compliance routes type-check. */
export type SessionUserRole =
  | 'ADMIN'
  | 'RBT'
  | 'CANDIDATE'
  | 'BCBA'
  | 'BILLING'
  | 'MARKETING'
  | 'CALL_CENTER'
  | 'DEV'
  | 'TRAINER'

export interface SessionUser {
  id: string
  phoneNumber: string | null
  role: SessionUserRole
  name?: string | null
  email?: string | null
  rbtProfileId?: string | null
}

export async function createSession(
  userId: string,
  metadata?: {
    device?: string | null
    browser?: string | null
    ipAddress?: string | null
  }
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      device: metadata?.device || null,
      browser: metadata?.browser || null,
      ipAddress: metadata?.ipAddress || null,
      lastActiveAt: new Date(),
    },
  })

  return token
}

const VALID_ROLES: SessionUserRole[] = [
  'ADMIN',
  'RBT',
  'CANDIDATE',
  'BCBA',
  'BILLING',
  'MARKETING',
  'CALL_CENTER',
  'DEV',
  'TRAINER',
]
function normalizeRole(role: string | null | undefined): SessionUserRole | null {
  const r = (role ?? '').toUpperCase()
  return VALID_ROLES.includes(r as SessionUserRole) ? (r as SessionUserRole) : null
}

/**
 * Session lookups sometimes omit `rbtProfile` (Prisma fallback / raw SQL). Messaging and other
 * RBT routes require `rbtProfileId` — resolve it from `users.id` when missing.
 */
export async function attachRbtProfileIdIfNeeded(user: SessionUser): Promise<SessionUser> {
  if (user.rbtProfileId) return user
  if (user.role !== 'RBT' && user.role !== 'CANDIDATE') return user
  try {
    const rp = await prisma.rBTProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (rp?.id) {
      return { ...user, rbtProfileId: rp.id }
    }
  } catch {
    // ignore
  }
  return user
}

/** Raw SQL fallback when Prisma fails (e.g. schema/connection issues). */
async function validateSessionRawSql(token: string): Promise<SessionUser | null> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        role: string
        email: string | null
        phoneNumber: string | null
        name: string | null
        expiresAt: Date
        rbtProfileId: string | null
      }>
    >`
      SELECT u.id, u.role, u.email, u."phoneNumber", u.name, s."expiresAt", rp.id AS "rbtProfileId"
      FROM sessions s
      JOIN users u ON u.id = s."userId"
      LEFT JOIN rbt_profiles rp ON rp."userId" = u.id
      WHERE s.token = ${token}
      LIMIT 1
    `
    const row = rows?.[0]
    if (!row || row.expiresAt < new Date()) return null
    const role = normalizeRole(row.role)
    if (!role) return null
    return attachRbtProfileIdIfNeeded({
      id: row.id,
      phoneNumber: row.phoneNumber,
      role,
      name: row.name,
      email: row.email,
      rbtProfileId: row.rbtProfileId ?? null,
    })
  } catch (err) {
    console.error('[auth][validateSessionRawSql]', (err as Error)?.message?.slice(0, 200))
    return null
  }
}

/** Magic token set by verify-otp dev bypass (localhost + OTP 123456). Not in DB; validateSession accepts it so redirect to dashboard works. */
export const LOCAL_DEV_SESSION_TOKEN = 'local-dev-session'

export async function validateSession(token: string): Promise<SessionUser | null> {
  // Localhost / non-production dev bypass only — never honor this cookie in production (forged cookie risk).
  if (
    token === LOCAL_DEV_SESSION_TOKEN &&
    process.env.NODE_ENV !== 'production'
  ) {
    await prisma.user.upsert({
      where: { id: 'local-dev-admin' },
      update: {},
      create: { id: 'local-dev-admin', name: 'Local Dev Admin', email: 'dev@riseandshine.local', role: 'ADMIN', isActive: true },
    }).catch(() => {})
    return {
      id: 'local-dev-admin',
      phoneNumber: null,
      role: 'ADMIN',
      name: 'Local Dev Admin',
      email: 'dev@riseandshine.local',
      rbtProfileId: null,
    }
  }

  try {
    let session: Awaited<ReturnType<typeof prisma.session.findUnique>> = null
    try {
      session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            include: {
              rbtProfile: true,
            },
          },
        },
      })
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? ''
      const code = (err as { code?: string })?.code
      if (msg.includes('rbt_profiles') || code === 'P2010') {
        try {
          session = await prisma.session.findUnique({
            where: { token },
            include: { user: true },
          })
        } catch {
          return validateSessionRawSql(token)
        }
      } else {
        return validateSessionRawSql(token)
      }
    }

    if (!session) {
      return null
    }
    if (session.expiresAt < new Date()) {
      return null
    }
    type SessionWithUser = typeof session & {
      user: { id: string; role: string; phoneNumber: string | null; name: string | null; email: string | null; rbtProfile?: { id: string } | null }
    }
    const sessionWithUser = session as SessionWithUser
    const { user } = sessionWithUser
    const role = normalizeRole(user.role)
    if (!role) {
      return null
    }
    return attachRbtProfileIdIfNeeded({
      id: user.id,
      phoneNumber: user.phoneNumber,
      role,
      name: user.name,
      email: user.email,
      rbtProfileId: user.rbtProfile?.id ?? null,
    })
  } catch (err: unknown) {
    return validateSessionRawSql(token)
  }
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  })
}

export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}

export { isSuperAdminEmail as isSuperAdmin } from '@/lib/constants'

/** Use for route guards so role casing or edge cases never cause false 403. */
export function isAdmin(user: SessionUser | null): user is SessionUser {
  return !!user && (user.role ?? '').toUpperCase() === 'ADMIN'
}

/** Get current session user from cookies (for use in server/API context). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

/**
 * For admin API Route Handlers: validates session and admin role.
 * Returns { user, response: null } if authorized, or { user: null, response: NextResponse } to return.
 * Usage: const auth = await requireAdminSession(); if (auth.response) return auth.response;
 */
export async function requireAdminSession(): Promise<
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse }
> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  if (!sessionToken) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await validateSession(sessionToken)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!isAdmin(user)) {
    return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, response: null }
}

/** Billing & Payroll: email allowlist only (Aaron, Kazi/Jamal, Fardeen, Shazia). */
export function isBillingManager(user: SessionUser | null): boolean {
  if (!user) return false
  return isBillingManagerEmail(user.email)
}

export async function requireBillingManagerSession(): Promise<
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse }
> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  if (!sessionToken) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await validateSession(sessionToken)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!isBillingManager(user)) {
    return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, response: null }
}

export async function requireRbtSession(): Promise<
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse }
> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  if (!sessionToken) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await validateSession(sessionToken)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = (user.role ?? '').toUpperCase()
  if ((role !== 'RBT' && role !== 'CANDIDATE') || !user.rbtProfileId) {
    return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, response: null }
}
