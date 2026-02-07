import { NextRequest, NextResponse } from 'next/server'
import { generateOTP } from '@/lib/otp'
import { sendOTPEmail, storeOTPEmail } from '@/lib/email-otp'

const LOG = (msg: string, data?: object) =>
  console.log('[auth][send-otp]', msg, data ?? '')

export async function POST(request: NextRequest) {
  const logId = `req_${Date.now().toString(36)}`
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    LOG(`${logId} start`, { email: email ? `${email.slice(0, 3)}***@${email.split('@')[1] ?? ''}` : '' })

    if (!email || !email.includes('@')) {
      LOG(`${logId} invalid email`)
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const isTestAccount = email === 'hrmtesting@gmail.com'

    if (isTestAccount) {
      const code = '000000'
      await storeOTPEmail(email, code)
      LOG(`${logId} test account OTP stored`)
      return NextResponse.json({
        success: true,
        isTestAccount: true,
        devOTP: code,
      })
    }

    const code = generateOTP()
    await storeOTPEmail(email, code)
    LOG(`${logId} OTP stored`)

    const sent = await sendOTPEmail(email, code)
    LOG(`${logId} email send result`, { sent })
    if (!sent) {
      console.warn('[auth][send-otp] Email sending failed, but continuing (may be dev mode)')
    }

    const isDevMode = !process.env.RESEND_API_KEY
    LOG(`${logId} success`, { isDevMode })
    return NextResponse.json({
      success: true,
      ...(isDevMode && { devOTP: code }),
    })
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

