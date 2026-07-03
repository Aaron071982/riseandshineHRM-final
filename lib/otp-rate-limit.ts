import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const WINDOW_MS = 15 * 60 * 1000

function currentWindowStart(now = new Date()): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS)
}

function retryAfterSeconds(windowStart: Date, now = new Date()): number {
  const windowEnd = windowStart.getTime() + WINDOW_MS
  return Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000))
}

async function pruneOldWindows(): Promise<void> {
  const cutoff = new Date(Date.now() - WINDOW_MS * 2)
  await prisma.otpRateLimit.deleteMany({
    where: { windowStart: { lt: cutoff } },
  })
}

export async function getRateLimitCount(key: string): Promise<number> {
  const windowStart = currentWindowStart()
  const row = await prisma.otpRateLimit.findUnique({
    where: { key_windowStart: { key, windowStart } },
    select: { count: true },
  })
  return row?.count ?? 0
}

export async function incrementRateLimit(key: string): Promise<number> {
  const windowStart = currentWindowStart()
  const row = await prisma.otpRateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  })
  void pruneOldWindows()
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

export async function assertSendOtpRateLimit(
  email: string,
  ip: string | null
): Promise<NextResponse | null> {
  const windowStart = currentWindowStart()
  const emailKey = `otp:send:email:${email}`
  const emailCount = await getRateLimitCount(emailKey)
  if (emailCount >= 5) {
    return rateLimitedResponse(
      retryAfterSeconds(windowStart),
      'Too many verification codes requested for this email. Please wait before trying again.'
    )
  }

  if (ip) {
    const ipKey = `otp:send:ip:${ip}`
    const ipCount = await getRateLimitCount(ipKey)
    if (ipCount >= 10) {
      return rateLimitedResponse(
        retryAfterSeconds(windowStart),
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
  const windowStart = currentWindowStart()
  const failKey = `otp:verify-fail:email:${email}`
  const failCount = await getRateLimitCount(failKey)
  if (failCount >= 5) {
    return rateLimitedResponse(
      retryAfterSeconds(windowStart),
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
