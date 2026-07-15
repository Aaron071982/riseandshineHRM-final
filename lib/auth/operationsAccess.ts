import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isSuperAdmin, validateSession, type SessionUser } from '@/lib/auth'
import { PLATFORM_OWNER_EMAIL } from '@/lib/constants'

/** Revenue-cycle dashboard: email allowlist (+ super-admins / platform owner). */
const DEFAULT_OPERATIONS_EMAILS = [
  'kazi@siyam.nyc',
  PLATFORM_OWNER_EMAIL,
  'aaronsiam25@gmail.com',
  'fardeen@riseandshineaba.com',
]

export function getOperationsAccessEmails(): string[] {
  const env = process.env.OPERATIONS_ACCESS_EMAILS?.trim()
  const base = env
    ? env
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_OPERATIONS_EMAILS.map((e) => e.toLowerCase())
  return [...new Set([...base, PLATFORM_OWNER_EMAIL])]
}

export function isOperationsViewer(user: SessionUser | null): boolean {
  if (!user?.email) return false
  if (isSuperAdmin(user.email)) return true
  const allowed = getOperationsAccessEmails()
  return allowed.includes(user.email.trim().toLowerCase())
}

export async function requireOperationsSession(): Promise<
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
  if (!isOperationsViewer(user)) {
    return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, response: null }
}
