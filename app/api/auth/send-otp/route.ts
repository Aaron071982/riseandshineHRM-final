import { NextRequest, NextResponse } from 'next/server'
import { sendOTPEmail, storeOTPEmail } from '@/lib/email-otp'
import { getOtpTestCode, isOtpTestAccount } from '@/lib/constants'
import { provisionBillingLoginIfNeeded } from '@/lib/billing-portal-users'
import { isOtpBypassEnvironment } from '@/lib/auth/otpBypass'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  assertSendOtpRateLimit,
  recordSendOtpAttempt,
} from '@/lib/otp-rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const hostname = request.nextUrl.hostname
    const ip = getClientIpFromRequest(request)

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const rateLimited = await assertSendOtpRateLimit(email, ip)
    if (rateLimited) return rateLimited

    await provisionBillingLoginIfNeeded(email)

    if (isOtpTestAccount(email) && isOtpBypassEnvironment(hostname)) {
      const code = getOtpTestCode()
      try {
        await storeOTPEmail(email, code)
      } catch {
        // still allow login with fixed code if store fails
      }
      await recordSendOtpAttempt(email, ip)
      return NextResponse.json({
        success: true,
        isTestAccount: true,
        devOTP: code,
      })
    }

    const isDevBypass = isOtpBypassEnvironment(hostname)
    const devBypassCode = '123456'
    if (isDevBypass) {
      try {
        await storeOTPEmail(email, devBypassCode)
      } catch {
        // ignore
      }
      await recordSendOtpAttempt(email, ip)
      return NextResponse.json({
        success: true,
        isDevBypass: true,
        devOTP: devBypassCode,
      })
    }

    try {
      const { generateOTP } = await import('@/lib/otp')
      const code = generateOTP()
      await storeOTPEmail(email, code)
      await recordSendOtpAttempt(email, ip)

      const sent = await sendOTPEmail(email, code)
      if (!sent) {
        console.warn('[auth][send-otp] OTP stored but email send returned false', { email })
      }

      return NextResponse.json({ success: true })
    } catch (productionErr: unknown) {
      const err = productionErr as Error
      console.error('[auth][send-otp] Production send/store failed', {
        message: err?.message,
        stack: err?.stack?.split('\n').slice(0, 4),
      })

      if (isOtpBypassEnvironment(hostname)) {
        const fallbackList = (process.env.ADMIN_FALLBACK_EMAIL ?? '')
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
        if (fallbackList.length > 0 && fallbackList.includes(email)) {
          await recordSendOtpAttempt(email, ip)
          return NextResponse.json({
            success: true,
            devOTP: '123456',
          })
        }
      }

      return NextResponse.json(
        { success: false, error: 'Unable to send verification code. Please try again or contact support.' },
        { status: 503 }
      )
    }
  } catch (error: unknown) {
    const err = error as Error
    console.error('[auth][send-otp] Error sending OTP', {
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 4),
    })
    return NextResponse.json(
      {
        error: 'Failed to send verification code',
        details: process.env.NODE_ENV === 'development' ? err?.message : undefined,
      },
      { status: 500 }
    )
  }
}
