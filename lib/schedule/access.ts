import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { validateSession, isAdmin, type SessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Default allowlist when table is empty / env not set */
const DEFAULT_SCHEDULE_EMAILS = [
  'kazi@siyam.nyc',
  'aaronsiam21@gmail.com',
  'fardeen@riseandshineaba.com',
  'hashir@riseandshineaba.com',
]

export async function getCurrentUserEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  const user = await validateSession(token)
  return user?.email?.trim().toLowerCase() ?? null
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function isScheduleUser(email: string | null): Promise<boolean> {
  if (!email) return false
  const normalized = email.trim().toLowerCase()

  // Guard: stale Prisma client (pre-generate) has no scheduleAllowedUser delegate
  const allowed = (prisma as { scheduleAllowedUser?: typeof prisma.scheduleAllowedUser })
    .scheduleAllowedUser
  if (allowed) {
    try {
      const row = await allowed.findFirst({
        where: { email: { equals: normalized, mode: 'insensitive' } },
        select: { id: true },
      })
      if (row) return true
    } catch (err) {
      // Table missing or DB error — fall through to env/default allowlist
      console.warn('[schedule] allowlist lookup failed, using fallback', err)
    }
  }

  // Fallback to env list (comma-separated) for bootstrap before seed runs
  const env = process.env.SCHEDULE_ACCESS_EMAILS?.trim()
  if (env) {
    return env
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes(normalized)
  }

  return DEFAULT_SCHEDULE_EMAILS.includes(normalized)
}

/** Admins can always open /schedule; others need the email allowlist. */
export async function canAccessSchedule(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  const email = user.email?.trim().toLowerCase() ?? null
  if (isAdmin(user)) return true
  return isScheduleUser(email)
}

export async function assertScheduleAccess(): Promise<string> {
  const user = await getCurrentSessionUser()
  if (!user) throw new Error('FORBIDDEN')
  const email = user.email?.trim().toLowerCase() ?? null
  if (isAdmin(user)) return email ?? 'admin'
  if (!(await isScheduleUser(email))) throw new Error('FORBIDDEN')
  return email!
}

export async function requireScheduleSession(): Promise<
  | { user: SessionUser; email: string; response: null }
  | { user: null; email: null; response: NextResponse }
> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  if (!sessionToken) {
    return {
      user: null,
      email: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const user = await validateSession(sessionToken)
  if (!user) {
    return {
      user: null,
      email: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const email = user.email?.trim().toLowerCase() ?? null
  if (!(await canAccessSchedule(user))) {
    return {
      user: null,
      email: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return { user, email: email ?? user.email ?? 'user', response: null }
}
