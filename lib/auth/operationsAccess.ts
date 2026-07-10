import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { validateSession, type SessionUser } from '@/lib/auth'

/** Revenue-cycle dashboard: strict email allowlist only (no blanket admin access). */
const DEFAULT_OPERATIONS_EMAILS = [
  'kazi@siyam.nyc',
  'aaronsiam21@gmail.com',
  'aaronsiam25@gmail.com',
  'fardeen@riseandshineaba.com',
]

export function getOperationsAccessEmails(): string[] {
  const env = process.env.OPERATIONS_ACCESS_EMAILS?.trim()
  if (env) {
    return env
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  }
  return DEFAULT_OPERATIONS_EMAILS.map((e) => e.toLowerCase())
}

export function isOperationsViewer(user: SessionUser | null): boolean {
  if (!user?.email) return false
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
