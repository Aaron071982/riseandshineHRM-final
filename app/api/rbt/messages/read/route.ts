import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** POST: Mark all admin messages as read for current RBT. */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await validateSession(sessionToken)
    if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      await prisma.rBTMessage.updateMany({
        where: {
          rbtProfileId: user.rbtProfileId,
          senderRole: 'ADMIN',
          isRead: false,
        },
        data: { isRead: true },
      })
    } catch (e) {
      const code = (e as { code?: string })?.code
      const msg = String((e as Error)?.message ?? '')
      if (code === 'P2021' || msg.includes('rbt_messages')) {
        return NextResponse.json({ success: true, message: 'Messaging table not available' })
      }
      throw e
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[rbt/messages/read] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    )
  }
}
