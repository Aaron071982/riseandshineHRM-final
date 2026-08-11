import { NextRequest, NextResponse } from 'next/server'
import { generateOTP } from '@/lib/otp'
import { storeOTPEmail, verifyOTPEmail, sendOTPEmail } from '@/lib/email-otp'
import {
  assertSendOtpRateLimit,
  recordSendOtpAttempt,
  assertVerifyOtpRateLimit,
  recordVerifyOtpFailure,
} from '@/lib/otp-rate-limit'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesEligibleSession,
  createElevatedSession,
  setElevatedSessionCookie,
  clearElevatedSessionCookie,
} from '@/lib/client-services/access'
import { clientServicesOtpEmailKey } from '@/lib/client-services/constants'
import { logClientAccess } from '@/lib/client-services/audit'
import { prisma } from '@/lib/prisma'
import { CS_SESSION_COOKIE } from '@/lib/client-services/constants'

export const dynamic = 'force-dynamic'

/**
 * Step-up OTP for Client Services.
 * POST { action: 'send' | 'verify' | 'logout', code?: string }
 * NO fixed/bypass codes — real emailed OTP only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireClientServicesEligibleSession()
  if (auth.response) return auth.response
  const user = auth.user
  const email = user.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Account email required for step-up' }, { status: 400 })
  }

  let body: { action?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = (body.action ?? '').toLowerCase()
  const ip = getClientIpFromRequest(request)

  if (action === 'logout') {
    const cookieStoreToken = request.cookies.get(CS_SESSION_COOKIE)?.value
    if (cookieStoreToken) {
      await prisma.clientServicesSession.deleteMany({ where: { token: cookieStoreToken } })
    }
    const res = NextResponse.json({ success: true })
    clearElevatedSessionCookie(res)
    await logClientAccess({ userId: user.id, action: 'SECTION_EXIT', ip })
    return res
  }

  if (action === 'send') {
    const limited = await assertSendOtpRateLimit(`cs:${email}`, ip)
    if (limited) return limited

    const code = generateOTP()
    const otpKey = clientServicesOtpEmailKey(email)
    await storeOTPEmail(otpKey, code)
    await recordSendOtpAttempt(`cs:${email}`, ip)

    const subjectHtmlOk = await sendClientServicesOtpEmail(email, code)
    if (!subjectHtmlOk) {
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 502 })
    }

    await logClientAccess({ userId: user.id, action: 'STEP_UP_OTP_SENT', ip })
    return NextResponse.json({ success: true, message: 'Verification code sent' })
  }

  if (action === 'verify') {
    const code = (body.code ?? '').trim().replace(/\s/g, '')
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 })
    }

    const verifyLimited = await assertVerifyOtpRateLimit(`cs:${email}`)
    if (verifyLimited) return verifyLimited

    const otpKey = clientServicesOtpEmailKey(email)
    const ok = await verifyOTPEmail(otpKey, code)
    if (!ok) {
      await recordVerifyOtpFailure(otpKey)
      await logClientAccess({ userId: user.id, action: 'STEP_UP_OTP_FAILED', ip })
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }

    const token = await createElevatedSession(user.id, ip)
    const res = NextResponse.json({ success: true, expiresInMinutes: 30 })
    setElevatedSessionCookie(res, token)
    await logClientAccess({ userId: user.id, action: 'SECTION_ENTRY', ip })
    return res
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

async function sendClientServicesOtpEmail(email: string, code: string): Promise<boolean> {
  // Reuse Resend path via temporary store — sendOTPEmail uses generic HRM copy;
  // for PHI step-up we send a distinct subject through the same transport.
  const { Resend } = await import('resend')
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    // Dev without Resend: still store OTP; code is NOT returned in response.
    console.info('[client-services] OTP generated (no RESEND_API_KEY); check otp_codes / get-latest-otp')
    return true
  }

  try {
    const resend = new Resend(resendApiKey)
    const emailFrom = process.env.EMAIL_FROM || 'noreply@riseandshinehrm.com'
    await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: 'Client Services — Restricted Access Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#1e293b;color:#fff;padding:20px;text-align:center">
            <h1 style="margin:0;font-size:18px">Restricted — Client PHI</h1>
          </div>
          <div style="padding:24px;background:#f8fafc">
            <p>You requested elevated access to the Client Services portal.</p>
            <p style="font-size:28px;font-weight:bold;letter-spacing:6px;text-align:center;padding:16px;background:#fff;border:2px dashed #334155">${code}</p>
            <p>This code expires in 5 minutes. If you did not request this, contact security immediately.</p>
          </div>
        </div>
      `,
    })
    return true
  } catch (err) {
    console.error('[client-services] OTP email failed', err)
    // Fall back to shared helper
    return sendOTPEmail(email, code)
  }
}
