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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      activityType,
      action,
      resourceType,
      resourceId,
      url,
      metadata,
    } = body

    // Get IP address and user agent
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const userAgent = request.headers.get('user-agent') || null

    // Create activity log entry
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        activityType,
        action,
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        url: url || null,
        metadata: metadata || null,
        ipAddress,
        userAgent,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking activity:', error)
    return NextResponse.json({ error: 'Failed to track activity' }, { status: 500 })
  }
}
