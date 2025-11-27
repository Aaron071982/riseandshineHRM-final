import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// This endpoint only works in development mode
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Find the most recent unused OTP for this email
    const otp = await prisma.otpCode.findFirst({
      where: {
        email,
        used: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!otp) {
      return NextResponse.json({ error: 'No OTP found. Request a new code.' }, { status: 404 })
    }

    const isExpired = new Date(otp.expiresAt) < new Date()

    return NextResponse.json({
      code: otp.code,
      expiresAt: otp.expiresAt,
      isExpired,
      timeRemaining: isExpired ? 0 : Math.round((new Date(otp.expiresAt).getTime() - new Date().getTime()) / 1000 / 60),
    })
  } catch (error) {
    console.error('Error getting OTP:', error)
    return NextResponse.json({ error: 'Failed to get OTP' }, { status: 500 })
  }
}

