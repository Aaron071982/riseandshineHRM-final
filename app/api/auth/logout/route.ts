import { NextRequest, NextResponse } from 'next/server'
import { deleteSession, validateSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    // Track logout before deleting session
    if (sessionToken) {
      try {
        const user = await validateSession(sessionToken)
        if (user) {
          const ipAddress =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            null

          await prisma.activityLog.create({
            data: {
              userId: user.id,
              activityType: 'LOGOUT',
              action: 'User logged out',
              ipAddress,
              userAgent: request.headers.get('user-agent') || null,
            },
          })
        }
      } catch (error) {
        // Don't fail logout if activity tracking fails
        console.error('Failed to track logout activity:', error)
      }

      await deleteSession(sessionToken)
    }

    cookieStore.delete('session')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error logging out:', error)
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    )
  }
}

