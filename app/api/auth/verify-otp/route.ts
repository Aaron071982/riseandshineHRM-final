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

    // Test account: allow any OTP for hrmtesting@gmail.com (or accept '000000')
    const isTestAccount = email.toLowerCase() === 'hrmtesting@gmail.com'
    let isValid = false
    
    if (isTestAccount) {
      // For test account, accept '000000' or verify normally
      isValid = otp === '000000' || await verifyOTPEmail(email, otp)
    } else {
      // Verify OTP normally
      isValid = await verifyOTPEmail(email, otp)
    }
    
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
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        rbtProfile: true,
      },
    })

    // Fallback: If not found by email, try finding via RBTProfile email
    // This handles cases where User.email might not match RBTProfile.email
    if (!user) {
      const rbtProfile = await prisma.rBTProfile.findFirst({
        where: { email },
        include: {
          user: true,
        },
      })
      if (rbtProfile && rbtProfile.user) {
        user = await prisma.user.findUnique({
          where: { id: rbtProfile.user.id },
          include: {
            rbtProfile: true,
          },
        })
      }
    }

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
      
      // If candidate is hired but role wasn't updated, fix it automatically
      if (user.rbtProfile.status === 'HIRED') {
        console.log(`Auto-updating user ${user.id} role from CANDIDATE to RBT (profile is HIRED)`)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: 'RBT',
            email: user.rbtProfile.email || user.email,
            isActive: true,
          },
        })
        // Update user object for session creation
        user.role = 'RBT'
      }
    }
    
    // RBT users should always be able to log in
    if (user.role === 'RBT') {
      // Ensure email matches RBTProfile email if available
      if (user.rbtProfile?.email && user.email !== user.rbtProfile.email) {
        console.log(`Syncing user ${user.id} email to match RBTProfile email`)
        await prisma.user.update({
          where: { id: user.id },
          data: { email: user.rbtProfile.email },
        })
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
  } catch (error: any) {
    console.error('❌ Error verifying OTP:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    })
    
    // Check if it's a Prisma connection error
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database server')) {
      console.error('🔴 Prisma P1001: Cannot reach database server')
      console.error('   DATABASE_URL host:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'NOT SET')
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    )
  }
}

