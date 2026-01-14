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
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          rbtProfile: true,
        },
      },
    },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  const user = session.user

  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    role: user.role as 'ADMIN' | 'RBT' | 'CANDIDATE',
    name: user.name,
    email: user.email,
    rbtProfileId: user.rbtProfile?.id || null,
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

