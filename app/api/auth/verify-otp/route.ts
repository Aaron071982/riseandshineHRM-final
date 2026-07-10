import { NextRequest, NextResponse } from 'next/server'
import { verifyOTPEmail, isActiveOtpLocked } from '@/lib/email-otp'
import { createSession, LOCAL_DEV_SESSION_TOKEN } from '@/lib/auth'
import { getOtpTestCode, isOtpTestAccount } from '@/lib/constants'
import { isOtpBypassEnvironment } from '@/lib/auth/otpBypass'
import {
  assertVerifyOtpRateLimit,
  recordVerifyOtpFailure,
} from '@/lib/otp-rate-limit'
import { provisionBillingLoginIfNeeded, shouldProvisionBillingLogin } from '@/lib/billing-portal-users'
import {
  getPostLoginPath,
  isDirectLoginRole,
  normalizeLoginRole,
  roleAllowedInOtpResponse,
} from '@/lib/auth/postLogin'
import { prisma } from '@/lib/prisma'


/** Find user by email (case-insensitive) or id; include rbtProfile when possible (fallback without if rbt_profiles has schema issues so admins can still log in). */
async function findUserByEmailWithProfile(
  email: string | null,
  userId?: string
): Promise<{ id: string; email: string | null; role: string; isActive: boolean; rbtProfile?: { id: string; email: string | null; status: string } | null } | null> {
  const include = { rbtProfile: true } as const
  try {
    if (userId) {
      return await prisma.user.findUnique({
        where: { id: userId },
        include,
      })
    }
    if (!email) return null
    // Case-insensitive lookup so "Iborasool123@gmail.com" and "lborasool123@gmail.com" (or any casing) match
    return await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include,
    })
  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? ''
    const code = (err as { code?: string })?.code
    if (msg.includes('rbt_profiles') || code === 'P2010') {
      if (userId) {
        return await prisma.user.findUnique({
          where: { id: userId },
          include: {},
        })
      }
      if (!email) return null
      return await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {},
      })
    }
    throw err
  }
}

/** Lightweight lookup (no rbtProfile join) — used after billing user provisioning. */
async function findUserByEmailSimple(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, role: true, isActive: true },
  })
}

export async function POST(request: NextRequest) {
  const logId = `req_${Date.now().toString(36)}`
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const otp = typeof body?.otp === 'string' ? body.otp.trim() : ''


    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      )
    }
    // Localhost / development bypass: accept fixed code 123456 so you can log in without email/OTP table.
    // Treat any non-production build OR explicit localhost hostname as eligible for the bypass so
    // `next start` on localhost still works even if NODE_ENV is "production".
    const hostname = request.nextUrl.hostname
    const isOtpBypassEnv = isOtpBypassEnvironment(hostname)
    const isDevBypass =
      isOtpBypassEnv && otp === '123456' && !isOtpTestAccount(email)
    const adminFallbackList = (process.env.ADMIN_FALLBACK_EMAIL ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const isAdminFallback =
      isOtpBypassEnv &&
      adminFallbackList.length > 0 &&
      adminFallbackList.includes(email) &&
      otp === '123456'
    const isFixedOtpTestLogin =
      isOtpBypassEnv && isOtpTestAccount(email) && otp === getOtpTestCode()
    const isBillingTestBypass =
      isOtpBypassEnv && email === 'aaronsiam23@gmail.com' && otp === '123456'
    let isValid = false

    const usesRealOtpFlow =
      !isFixedOtpTestLogin && !isBillingTestBypass && !isDevBypass && !isAdminFallback

    if (usesRealOtpFlow) {
      const rateLimited = await assertVerifyOtpRateLimit(email)
      if (rateLimited) return rateLimited
      if (await isActiveOtpLocked(email)) {
        return NextResponse.json(
          {
            error:
              'This verification code was locked after too many failed attempts. Request a new code.',
          },
          { status: 429 }
        )
      }
    }

    if (isFixedOtpTestLogin) {
      isValid = true
    } else if (isBillingTestBypass) {
      let billingUser = await findUserByEmailWithProfile(email)
      if (!billingUser) {
        billingUser = await prisma.user
          .create({
            data: {
              email,
              name: 'Aaron Billing Test',
              role: 'BILLING',
              isActive: true,
            },
          })
          .catch(() => null)
      }
      if (billingUser?.role === 'BILLING' && billingUser.isActive) {
        const userAgent = request.headers.get('user-agent') || ''
        const ipAddress =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          null
        const { device, browser } = parseUserAgent(userAgent)
        const sessionToken = await createSession(billingUser.id, { device, browser, ipAddress })
        const response = NextResponse.json({ success: true, role: 'BILLING', userId: billingUser.id })
        response.cookies.set('session', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60,
          path: '/',
        })
        return response
      }
      return NextResponse.json(
        { error: 'No BILLING account found for this email. Run: npm run db:add-billing-user' },
        { status: 403 }
      )
    }

    // For quick localhost / non-production testing, accept a fixed OTP (123456) and
    // short‑circuit before any database calls. This does NOT apply on production hosts.
    if (isDevBypass) {
      const response = NextResponse.json({
        success: true,
        role: 'ADMIN',
        userId: 'local-dev-admin',
      })
      response.cookies.set('session', LOCAL_DEV_SESSION_TOKEN, {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      })
      return response
    } else if (isAdminFallback) {
      isValid = true
    } else if (!isValid) {
      try {
        isValid = await verifyOTPEmail(email, otp)
      } catch (verifyErr) {
        throw verifyErr
      }
    }

    if (!isValid) {
      if (usesRealOtpFlow) {
        await recordVerifyOtpFailure(email)
      }
      const recentCode = await prisma.otpCode.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)
      const isExpired = recentCode ? new Date(recentCode.expiresAt) < new Date() : null
      let errorMessage = 'Invalid or expired verification code'
      if (recentCode && process.env.NODE_ENV === 'development') {
        errorMessage = isExpired
          ? `Code expired. Request a new code.`
          : `Invalid code. Check your terminal/console for the correct OTP.`
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      )
    }

    // Create billing login user before lookup (production may only have billing_profiles row).
    await provisionBillingLoginIfNeeded(email)

    let user = await findUserByEmailWithProfile(email)
    if (!user) {
      const simple = await findUserByEmailSimple(email)
      if (simple) {
        user = { ...simple, rbtProfile: null }
      }
    }
    if (!user) {
      // Case-insensitive lookup so hired RBTs can log in regardless of email casing in profile
      const rbtProfile = await prisma.rBTProfile.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { userId: true },
      }).catch((e) => {
        return null
      })
      if (rbtProfile) {
        user = await findUserByEmailWithProfile(null, rbtProfile.userId)
      }
    }

    if (!user) {
      await provisionBillingLoginIfNeeded(email)
      const simple = await findUserByEmailSimple(email)
      if (simple) {
        user = { ...simple, rbtProfile: null }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.' },
        { status: 403 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.' },
        { status: 403 }
      )
    }


    // Billing portal: never block as CANDIDATE — upgrade role if mis-assigned.
    if (user.role === 'CANDIDATE' && (await shouldProvisionBillingLogin(email))) {
      await provisionBillingLoginIfNeeded(email)
      const upgraded = await findUserByEmailSimple(email)
      if (upgraded?.role === 'BILLING') {
        user = { ...upgraded, rbtProfile: null }
      }
    }

    const roleUpper = normalizeLoginRole(user.role)

    // --- Role gate after OTP success ---
    // Staff roles (BILLING, TRAINER, PAYROLL, ADMIN, BCBA, …) and RBT: allowed without CANDIDATE hire check.
    // CANDIDATE: only if linked RBT profile is HIRED (promoted to RBT below).
    if (roleUpper === 'CANDIDATE') {
      if (!user.rbtProfile || user.rbtProfile.status !== 'HIRED') {
        return NextResponse.json(
          {
            error:
              'Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.',
          },
          { status: 403 }
        )
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'RBT',
          email: user.rbtProfile.email || user.email,
          isActive: true,
        },
      })
      user.role = 'RBT'
    } else if (!isDirectLoginRole(roleUpper)) {
      return NextResponse.json(
        {
          error:
            'Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.',
        },
        { status: 403 }
      )
    }

    // RBT users: block terminated profiles
    if (normalizeLoginRole(user.role) === 'RBT' && user.rbtProfile?.status === 'FIRED') {
      return NextResponse.json(
        {
          error:
            'Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.',
        },
        { status: 403 }
      )
    }

    // RBT users: keep email in sync with profile
    if (normalizeLoginRole(user.role) === 'RBT') {
      // Ensure email matches RBTProfile email if available
      if (user.rbtProfile?.email && user.email !== user.rbtProfile.email) {
        await prisma.user.update({
          where: { id: user.id },
          data: { email: user.rbtProfile.email },
        })
      }
    }

    const userAgent = request.headers.get('user-agent') || ''
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    const { device, browser } = parseUserAgent(userAgent)

    let sessionToken: string
    try {
      sessionToken = await createSession(user.id, {
        device,
        browser,
        ipAddress,
      })
    } catch (createErr) {
      console.error('[auth][verify-otp] createSession failed', createErr)
      return NextResponse.json(
        { error: 'We couldn’t sign you in right now. Please try again in a moment.' },
        { status: 503 }
      )
    }

    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'LOGIN',
          action: 'User logged in',
          ipAddress,
          userAgent: request.headers.get('user-agent') || null,
          metadata: {
            device,
            browser,
            email: user.email,
            role: user.role,
          },
        },
      })
    } catch (error) {
      console.error('[auth][verify-otp] Failed to track login activity', error)
    }

    const roleNormalized = normalizeLoginRole(user.role)
    if (!roleAllowedInOtpResponse(roleNormalized)) {
      return NextResponse.json(
        {
          error:
            'Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.',
        },
        { status: 403 }
      )
    }

    const response = NextResponse.json({
      success: true,
      role: roleNormalized,
      redirectTo: getPostLoginPath(roleNormalized),
      userId: user.id,
    })
    // Set cookie on the response we return so it is always sent (avoids redirect-to-home bug)
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })
    return response
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; meta?: unknown; stack?: string }
    console.error('[auth][verify-otp] Error verifying OTP', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack?.split('\n').slice(0, 5),
    })
    
    const isDbError =
      err?.code === 'P1001' ||
      err?.code === 'P1002' ||
      err?.code === 'P1011' || // TLS / connection closed
      err?.code === 'P1017' ||
      (err?.message &&
        (err.message.includes("Can't reach database") ||
          err.message.includes('Error opening a TLS connection') ||
          err.message.includes('Connection') ||
          err.message.includes('ECONNREFUSED') ||
          err.message.includes('ETIMEDOUT')))
    if (isDbError) {
      return NextResponse.json(
        { error: 'Server is temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Something went wrong verifying your code. Please try again.' },
      { status: 500 }
    )
  }
}

function parseUserAgent(userAgent: string): { device: string | null; browser: string | null } {
  const ua = userAgent.toLowerCase()
  let device: string | null = null
  let browser: string | null = null

  if (ua.includes('android')) device = 'Android'
  else if (ua.includes('iphone') || ua.includes('ipad')) device = 'iOS'
  else if (ua.includes('mac os')) device = 'Mac'
  else if (ua.includes('windows')) device = 'Windows'
  else if (ua.includes('linux')) device = 'Linux'

  if (ua.includes('edg/')) browser = 'Edge'
  else if (ua.includes('chrome')) browser = 'Chrome'
  else if (ua.includes('safari')) browser = 'Safari'
  else if (ua.includes('firefox')) browser = 'Firefox'

  return { device, browser }
}

