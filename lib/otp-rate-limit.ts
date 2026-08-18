import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_WINDOW_MS = 15 * 60 * 1000

function currentWindowStart(windowMs: number, now = new Date()): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

function retryAfterSeconds(windowStart: Date, windowMs: number, now = new Date()): number {
  const windowEnd = windowStart.getTime() + windowMs
  return Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000))
}

async function pruneOldWindows(windowMs: number): Promise<void> {
  const cutoff = new Date(Date.now() - windowMs * 2)
  await prisma.otpRateLimit.deleteMany({
    where: { windowStart: { lt: cutoff } },
  })
}

export async function getRateLimitCount(
  key: string,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<number> {
  const windowStart = currentWindowStart(windowMs)
  const row = await prisma.otpRateLimit.findUnique({
    where: { key_windowStart: { key, windowStart } },
    select: { count: true },
  })
  return row?.count ?? 0
}

export async function incrementRateLimit(
  key: string,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<number> {
  const windowStart = currentWindowStart(windowMs)
  const row = await prisma.otpRateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  })
  void pruneOldWindows(windowMs)
  return row.count
}

export function rateLimitedResponse(
  retryAfterSec: number,
  message = 'Too many attempts. Please try again later.'
): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    }
  )
}

/**
 * Shared DB-backed rate limit (otp_rate_limits table).
 * Returns a 429 when over `limit` in the current window; otherwise increments and returns null.
 */
export async function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number = DEFAULT_WINDOW_MS,
  message?: string
): Promise<NextResponse | null> {
  const windowStart = currentWindowStart(windowMs)
  const count = await getRateLimitCount(key, windowMs)
  if (count >= limit) {
    return rateLimitedResponse(
      retryAfterSeconds(windowStart, windowMs),
      message ?? 'Too many attempts. Please try again later.'
    )
  }
  await incrementRateLimit(key, windowMs)
  return null
}

export async function assertSendOtpRateLimit(
  email: string,
  ip: string | null
): Promise<NextResponse | null> {
  const windowMs = DEFAULT_WINDOW_MS
  const windowStart = currentWindowStart(windowMs)
  const emailKey = `otp:send:email:${email}`
  const emailCount = await getRateLimitCount(emailKey, windowMs)
  if (emailCount >= 5) {
    return rateLimitedResponse(
      retryAfterSeconds(windowStart, windowMs),
      'Too many verification codes requested for this email. Please wait before trying again.'
    )
  }

  if (ip) {
    const ipKey = `otp:send:ip:${ip}`
    const ipCount = await getRateLimitCount(ipKey, windowMs)
    if (ipCount >= 10) {
      return rateLimitedResponse(
        retryAfterSeconds(windowStart, windowMs),
        'Too many verification code requests from this network. Please wait before trying again.'
      )
    }
  }

  return null
}

export async function recordSendOtpAttempt(email: string, ip: string | null): Promise<void> {
  await incrementRateLimit(`otp:send:email:${email}`)
  if (ip) {
    await incrementRateLimit(`otp:send:ip:${ip}`)
  }
}

export async function assertVerifyOtpRateLimit(email: string): Promise<NextResponse | null> {
  const windowMs = DEFAULT_WINDOW_MS
  const windowStart = currentWindowStart(windowMs)
  const failKey = `otp:verify-fail:email:${email}`
  const failCount = await getRateLimitCount(failKey, windowMs)
  if (failCount >= 5) {
    return rateLimitedResponse(
      retryAfterSeconds(windowStart, windowMs),
      'Too many failed verification attempts. Please wait before trying again.'
    )
  }
  return null
}

export async function recordVerifyOtpFailure(email: string): Promise<void> {
  await incrementRateLimit(`otp:verify-fail:email:${email}`)
  await recordOtpCodeFailedAttempt(email)
}

const MAX_OTP_CODE_ATTEMPTS = 5

/** Increment failures on the active OTP for this email; invalidate after 5 wrong guesses. */
export async function recordOtpCodeFailedAttempt(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase()
  const latest = await prisma.otpCode.findFirst({
    where: {
      email: cleanEmail,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, failedAttempts: true },
  })
  if (!latest) return

  const nextAttempts = latest.failedAttempts + 1
  await prisma.otpCode.update({
    where: { id: latest.id },
    data: {
      failedAttempts: nextAttempts,
      ...(nextAttempts >= MAX_OTP_CODE_ATTEMPTS ? { used: true } : {}),
    },
  })
}
