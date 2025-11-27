import { NextRequest, NextResponse } from 'next/server'
import { generateOTP } from '@/lib/otp'
import { sendOTPEmail, storeOTPEmail } from '@/lib/email-otp'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Generate and store OTP
    const code = generateOTP()
    await storeOTPEmail(email, code)

    // Send OTP via email
    const sent = await sendOTPEmail(email, code)
    if (!sent) {
      // Even if email fails in dev, we still return success since we log it
      console.warn('Email sending failed, but continuing (may be dev mode)')
    }

    // In development mode, return the OTP code so user can see it
    const isDevMode = !process.env.RESEND_API_KEY
    return NextResponse.json({ 
      success: true,
      ...(isDevMode && { devOTP: code }) // Only include in dev mode
    })
  } catch (error: any) {
    console.error('Error sending OTP:', error)
    console.error('Error details:', error?.message, error?.stack)
    return NextResponse.json(
      { 
        error: 'Failed to send verification code',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

