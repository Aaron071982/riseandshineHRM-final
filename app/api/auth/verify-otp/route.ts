import { NextRequest, NextResponse } from 'next/server'
import { verifyOTPEmail } from '@/lib/email-otp'
import { createSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      )
    }

    // Verify OTP
    const isValid = await verifyOTPEmail(email, otp)
    if (!isValid) {
      // In dev mode, check if there's a valid code to help debug
      const recentCode = await prisma.otpCode.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' },
      })
      
      let errorMessage = 'Invalid or expired verification code'
      if (recentCode && process.env.NODE_ENV === 'development') {
        const isExpired = new Date(recentCode.expiresAt) < new Date()
        errorMessage = isExpired
          ? `Code expired. Request a new code.`
          : `Invalid code. Check your terminal/console for the correct OTP.`
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        rbtProfile: true,
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.' },
        { status: 403 }
      )
    }

    // Check if user is a hired RBT or admin
    if (user.role === 'CANDIDATE') {
      // Candidates who aren't hired yet can't log in
      if (!user.rbtProfile || user.rbtProfile.status !== 'HIRED') {
        return NextResponse.json(
          { error: 'Your email is not yet associated with an active Rise and Shine account. Please contact an administrator.' },
          { status: 403 }
        )
      }
    }

    // Create session
    const sessionToken = await createSession(user.id)
    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    return NextResponse.json({
      success: true,
      role: user.role,
      userId: user.id,
    })
  } catch (error) {
    console.error('Error verifying OTP:', error)
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    )
  }
}

