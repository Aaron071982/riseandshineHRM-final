import { prisma } from './prisma'
import crypto from 'crypto'

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

export interface SessionUser {
  id: string
  phoneNumber: string | null
  role: 'ADMIN' | 'RBT' | 'CANDIDATE'
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

const VALID_ROLES = ['ADMIN', 'RBT', 'CANDIDATE'] as const
function normalizeRole(role: string | null | undefined): 'ADMIN' | 'RBT' | 'CANDIDATE' | null {
  const r = (role ?? '').toUpperCase()
  return VALID_ROLES.includes(r as any) ? (r as 'ADMIN' | 'RBT' | 'CANDIDATE') : null
}

/** Raw SQL fallback when Prisma fails (e.g. schema/connection issues). */
async function validateSessionRawSql(token: string): Promise<SessionUser | null> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; role: string; email: string | null; phoneNumber: string | null; name: string | null; expiresAt: Date }>
    >`
      SELECT u.id, u.role, u.email, u."phoneNumber", u.name, s."expiresAt"
      FROM sessions s
      JOIN users u ON u.id = s."userId"
      WHERE s.token = ${token}
      LIMIT 1
    `
    const row = rows?.[0]
    if (!row || row.expiresAt < new Date()) return null
    const role = normalizeRole(row.role)
    if (!role) return null
    return {
      id: row.id,
      phoneNumber: row.phoneNumber,
      role,
      name: row.name,
      email: row.email,
      rbtProfileId: null,
    }
  } catch (err) {
    console.error('[auth][validateSessionRawSql]', (err as Error)?.message?.slice(0, 200))
    return null
  }
}

export async function validateSession(token: string): Promise<SessionUser | null> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth:validateSession','message':'entry',data:{hasToken:!!token,len:token?.length??0},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  const log = (msg: string, data?: object) =>
    console.log('[auth][validateSession]', msg, data ?? '')

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
      log('session lookup error, will retry without rbtProfile', {
        prismaCode: code,
        message: msg.slice(0, 180),
      })
      if (msg.includes('rbt_profiles') || code === 'P2010') {
        try {
          session = await prisma.session.findUnique({
            where: { token },
            include: { user: true },
          })
        } catch {
          log('fallback session lookup failed, trying raw SQL')
          return validateSessionRawSql(token)
        }
      } else {
        log('session lookup failed, trying raw SQL', { message: msg.slice(0, 120) })
        return validateSessionRawSql(token)
      }
    }

    if (!session) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth:validateSession','message':'no session row',data:{},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      log('no session found for token')
      return null
    }
    if (session.expiresAt < new Date()) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth:validateSession','message':'session expired',data:{expiresAt:(session.expiresAt as Date).toISOString()},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      log('session expired', { expiresAt: session.expiresAt.toISOString() })
      return null
    }
    type SessionWithUser = typeof session & {
      user: { id: string; role: string; phoneNumber: string | null; name: string | null; email: string | null; rbtProfile?: { id: string } | null }
    }
    const sessionWithUser = session as SessionWithUser
    const { user } = sessionWithUser
    const role = normalizeRole(user.role)
    if (!role) {
      log('invalid role', { role: user.role })
      return null
    }
    log('valid', { userId: user.id, role })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth:validateSession','message':'valid',data:{userId:user.id,role},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role,
      name: user.name,
      email: user.email,
      rbtProfileId: user.rbtProfile?.id ?? null,
    }
  } catch (err: unknown) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth:validateSession','message':'threw→raw',data:{msg:(err as Error)?.message?.slice(0,80)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    log('validateSession threw, using raw SQL', { message: (err as Error)?.message?.slice(0, 120) })
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

export function isSuperAdmin(email: string | null | undefined): boolean {
  const superAdmins = ['aaronsiam21@gmail.com', 'alvi@riseandshiny.nyc']
  return !!email && superAdmins.includes(email)
}

/** Use for route guards so role casing or edge cases never cause false 403. */
export function isAdmin(user: SessionUser | null): user is SessionUser {
  return !!user && (user.role ?? '').toUpperCase() === 'ADMIN'
}
