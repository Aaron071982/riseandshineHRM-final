'use server'

import crypto from 'crypto'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import { getClientIpFromHeaders } from '@/lib/client-ip'
import {
  canAccessClientServices,
  createElevatedSession,
} from '@/lib/client-services/access'
import {
  CS_SESSION_COOKIE,
  CS_SESSION_IDLE_MS,
  CS_SESSION_ABSOLUTE_MS,
} from '@/lib/client-services/constants'
import { logClientAccess } from '@/lib/client-services/audit'
import { getRateLimitCount, incrementRateLimit } from '@/lib/otp-rate-limit'

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    // Still compare to avoid leaking length via early return timing alone.
    crypto.timingSafeEqual(aBuf, aBuf)
    return false
  }
  return crypto.timingSafeEqual(aBuf, bBuf)
}

function getAccessCodeFromEnv(): string | null {
  const code = process.env.CLIENT_SERVICES_ACCESS_CODE?.trim()
  return code || null
}

export type UnlockClientServicesResult =
  | { ok: true; idleTimeoutMinutes: number; absoluteMaxHours: number }
  | { ok: false; error: string }

/**
 * Step-up unlock for Client Services using CLIENT_SERVICES_ACCESS_CODE.
 * On success: mints client_services_sessions + httpOnly cookie.
 * Idle timeout is 1h (sliding); absolute cap is 12h.
 * On failure: logs UNLOCK_FAILED.
 */
export async function unlockClientServices(
  code: string
): Promise<UnlockClientServicesResult> {
  const cookieStore = await cookies()
  const mainToken = cookieStore.get('session')?.value
  if (!mainToken) {
    return { ok: false, error: 'Unauthorized' }
  }

  const user = await validateSession(mainToken)
  if (!user || !(await canAccessClientServices(user))) {
    return { ok: false, error: 'Forbidden' }
  }

  const hdrs = await headers()
  const ip = getClientIpFromHeaders(hdrs)

  const unlockWindowMs = 15 * 60 * 1000
  const unlockKey = `crm:unlock:user:${user.id}`
  if ((await getRateLimitCount(unlockKey, unlockWindowMs)) >= 10) {
    return {
      ok: false,
      error: 'Too many unlock attempts. Please wait before trying again.',
    }
  }
  await incrementRateLimit(unlockKey, unlockWindowMs)

  const expected = getAccessCodeFromEnv()
  if (!expected) {
    console.error('[client-services] CLIENT_SERVICES_ACCESS_CODE is not set')
    return { ok: false, error: 'Access code not configured' }
  }

  const submitted = (code ?? '').trim()
  const ok = timingSafeEqualString(submitted, expected)
  if (!ok) {
    await logClientAccess({
      userId: user.id,
      action: 'UNLOCK_FAILED',
      ip,
    })
    return { ok: false, error: 'Invalid access code' }
  }

  const token = await createElevatedSession(user.id, ip)
  cookieStore.set(CS_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(CS_SESSION_ABSOLUTE_MS / 1000),
    path: '/',
  })

  await logClientAccess({
    userId: user.id,
    action: 'SECTION_ENTRY',
    ip,
  })

  return {
    ok: true,
    idleTimeoutMinutes: CS_SESSION_IDLE_MS / (60 * 1000),
    absoluteMaxHours: CS_SESSION_ABSOLUTE_MS / (60 * 60 * 1000),
  }
}

/** Guard for pages: redirects to /client-services if elevated session missing. */
export async function requireClientServicesSessionOrRedirect(): Promise<void> {
  const cookieStore = await cookies()
  const mainToken = cookieStore.get('session')?.value
  if (!mainToken) redirect('/login')

  const user = await validateSession(mainToken)
  if (!user || !(await canAccessClientServices(user))) {
    redirect('/admin/dashboard')
  }

  const csToken = cookieStore.get(CS_SESSION_COOKIE)?.value
  const { validateElevatedSession } = await import('@/lib/client-services/access')
  const elevated = await validateElevatedSession(csToken)
  if (!elevated) {
    redirect('/client-services')
  }
}
