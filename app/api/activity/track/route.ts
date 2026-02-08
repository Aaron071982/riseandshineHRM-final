import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false }, { status: 200 })
    }

    const user = await validateSession(sessionToken).catch(() => null)
    if (!user) {
      return NextResponse.json({ success: false }, { status: 200 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      activityType,
      action,
      resourceType,
      resourceId,
      url,
      metadata,
    } = body || {}

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const userAgent = request.headers.get('user-agent') || null

    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: (['PAGE_VIEW', 'LINK_CLICK', 'BUTTON_CLICK', 'FORM_SUBMISSION', 'LOGIN', 'LOGOUT'].includes(activityType) ? activityType : 'PAGE_VIEW') as 'PAGE_VIEW' | 'LINK_CLICK' | 'BUTTON_CLICK' | 'FORM_SUBMISSION' | 'LOGIN' | 'LOGOUT',
          action: action ?? 'Unknown',
          resourceType: resourceType || null,
          resourceId: resourceId || null,
          url: url || null,
          metadata: metadata || null,
          ipAddress,
          userAgent,
        },
      })
    } catch (err) {
      console.error('Error tracking activity:', err)
    }
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Activity track error:', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
