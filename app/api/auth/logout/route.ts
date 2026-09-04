import { NextRequest, NextResponse } from 'next/server'
import { deleteSession, validateSession } from '@/lib/auth'
import { MICROSOFT_GRAPH_TOKEN_COOKIE } from '@/lib/auth/microsoft'
import {
  clearElevatedSessionCookie,
  revokeAllClientServicesElevatedSessions,
} from '@/lib/client-services/access'
import { CS_SESSION_COOKIE } from '@/lib/client-services/constants'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    let userId: string | null = null

    // Track logout before deleting session
    if (sessionToken) {
      try {
        const user = await validateSession(sessionToken)
        if (user) {
          userId = user.id
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

    if (userId) {
      await revokeAllClientServicesElevatedSessions(userId)
    } else {
      const csToken = cookieStore.get(CS_SESSION_COOKIE)?.value
      if (csToken) {
        await prisma.clientServicesSession
          .deleteMany({ where: { token: csToken } })
          .catch(() => {})
      }
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    response.cookies.set(MICROSOFT_GRAPH_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    clearElevatedSessionCookie(response)
    return response
  } catch (error) {
    console.error('Error logging out:', error)
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    )
  }
}

