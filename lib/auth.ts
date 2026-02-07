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

export async function validateSession(token: string): Promise<SessionUser | null> {
  const log = (msg: string, data?: object) =>
    console.log('[auth][validateSession]', msg, data ?? '')
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
      } catch (fallbackErr) {
        log('fallback session lookup failed', { message: (fallbackErr as Error)?.message?.slice(0, 120) })
        return null
      }
    } else {
      log('session lookup failed, returning null', { message: msg.slice(0, 120) })
      return null
    }
  }

  if (!session) {
    log('no session found for token')
    return null
  }
  if (session.expiresAt < new Date()) {
    log('session expired', { expiresAt: session.expiresAt.toISOString() })
    return null
  }
  type SessionWithUser = typeof session & {
    user: { id: string; role: string; phoneNumber: string | null; name: string | null; email: string | null; rbtProfile?: { id: string } | null }
  }
  const sessionWithUser = session as SessionWithUser
  log('valid', { userId: sessionWithUser.user.id, role: sessionWithUser.user.role })

  const { user } = sessionWithUser
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    role: user.role as 'ADMIN' | 'RBT' | 'CANDIDATE',
    name: user.name,
    email: user.email,
    rbtProfileId: user.rbtProfile?.id ?? null,
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
