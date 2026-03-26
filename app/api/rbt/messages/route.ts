import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { makePublicUrl } from '@/lib/baseUrl'

function isPrismaOrSchemaError(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  const msg = String((e as Error)?.message ?? '')
  const lower = msg.toLowerCase()
  return (
    code === 'P2021' || // table does not exist
    code === 'P2010' || // raw query failed
    code === 'P1001' || // can't reach DB
    lower.includes('does not exist') ||
    lower.includes("doesn't exist") ||
    lower.includes('rbt_messages') ||
    (lower.includes('relation') && lower.includes('exist')) ||
    (lower.includes('table') && lower.includes('exist'))
  )
}

/** GET: List messages for current RBT. */
export async function GET() {
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

    let messages: Array<{ id: string; senderRole: string; message: string; isRead: boolean; createdAt: Date }> = []
    try {
      messages = await prisma.rBTMessage.findMany({
        where: { rbtProfileId: user.rbtProfileId },
        orderBy: { createdAt: 'asc' },
      })
    } catch (e) {
      if (isPrismaOrSchemaError(e)) {
        console.warn('[rbt/messages] GET: rbt_messages inaccessible:', (e as Error)?.message)
        return NextResponse.json({ messages: [], unreadFromAdmin: 0 })
      }
      throw e
    }

    const unreadFromAdmin = messages.filter(
      (m) => m.senderRole === 'ADMIN' && !m.isRead
    ).length

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        senderRole: m.senderRole,
        message: m.message,
        isRead: m.isRead,
        createdAt: m.createdAt.toISOString(),
      })),
      unreadFromAdmin,
    })
  } catch (error) {
    console.error('[rbt/messages] GET error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load messages'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to load messages' },
      { status: 500 }
    )
  }
}

/** POST: Send a message (RBT). */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    let created: { id: string; senderRole: string; message: string; isRead: boolean; createdAt: Date }
    try {
      created = await prisma.rBTMessage.create({
        data: {
          rbtProfileId: user.rbtProfileId,
          senderRole: 'RBT',
          message,
        },
      })
    } catch (e) {
      if (isPrismaOrSchemaError(e)) {
        console.error('[rbt/messages] POST: rbt_messages inaccessible. Run: npx prisma db push', (e as Error)?.message)
        return NextResponse.json(
          { error: 'Messaging is not set up yet. Run "npx prisma db push" to create the messages table, or contact support.' },
          { status: 503 }
        )
      }
      throw e
    }

    try {
      const profile = await prisma.rBTProfile.findUnique({
        where: { id: user.rbtProfileId },
        select: { firstName: true, lastName: true },
      })
      const name = profile ? `${profile.firstName} ${profile.lastName}` : 'An RBT'
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      })
      const messagesUrl = makePublicUrl('/admin/messages')
      for (const admin of adminUsers) {
        await prisma.adminNotification.create({
          data: {
            userId: admin.id,
            type: 'RBT_MESSAGE',
            message: `${name} sent a message`,
            linkUrl: messagesUrl,
          },
        }).catch(() => {})
      }
    } catch (notifyErr) {
      console.warn('[rbt/messages] POST: admin notifications skipped', notifyErr)
    }

    return NextResponse.json({
      id: created.id,
      senderRole: created.senderRole,
      message: created.message,
      isRead: created.isRead,
      createdAt: created.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('[rbt/messages] POST error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to send message'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? msg : 'Failed to send message' },
      { status: 500 }
    )
  }
}
