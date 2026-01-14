import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const rbtId = searchParams.get('rbtId')

    if (!token || !rbtId) {
      return NextResponse.json({ valid: false, error: 'Missing token or RBT ID' }, { status: 400 })
    }

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: {
        id: rbtId,
        schedulingToken: token,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    })

    if (!rbtProfile) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired scheduling token' }, { status: 404 })
    }

    // Check if interview is already scheduled
    const existingInterview = await prisma.interview.findFirst({
      where: {
        rbtProfileId: rbtId,
        status: 'SCHEDULED',
      },
    })

    if (existingInterview) {
      return NextResponse.json({ 
        valid: false, 
        error: 'You already have a scheduled interview. Please contact support if you need to reschedule.' 
      }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      rbtName: `${rbtProfile.firstName} ${rbtProfile.lastName}`,
    })
  } catch (error: any) {
    console.error('Error validating scheduling token:', error)
    return NextResponse.json(
      { valid: false, error: 'An error occurred while validating the token' },
      { status: 500 }
    )
  }
}
