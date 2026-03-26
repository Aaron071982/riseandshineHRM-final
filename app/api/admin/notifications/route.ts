import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const userId = auth.user.id

    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true'
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 100)

    const where = { userId }
    if (unreadOnly) {
      ;(where as Record<string, unknown>).isRead = false
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          message: true,
          linkUrl: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.adminNotification.count({ where: { userId, isRead: false } }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('GET notifications:', error)
    // Return empty list so the notification bell doesn't break the UI (e.g. if table missing or DB busy)
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const userId = auth.user.id

    const body = await request.json().catch(() => ({}))
    if (body.action === 'mark_all_read') {
      await prisma.adminNotification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('PATCH notifications:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}

