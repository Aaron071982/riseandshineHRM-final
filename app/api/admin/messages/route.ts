import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isPrismaTableError(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  const msg = (e as Error)?.message ?? ''
  return code === 'P2021' || msg.includes('does not exist') || msg.includes('rbt_messages')
}

/** GET: List RBTs who have sent messages (conversations) with unread count. */
export async function GET() {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    let profilesWithMessages: Array<{ rbtProfileId: string }> = []
    try {
      // Any thread with at least one message (RBT or admin), not only RBT-originated
      profilesWithMessages = await prisma.rBTMessage.findMany({
        distinct: ['rbtProfileId'],
        select: { rbtProfileId: true },
      })
    } catch (e) {
      if (isPrismaTableError(e)) {
        console.warn('[admin/messages] GET: rbt_messages table missing, returning empty conversations')
        return NextResponse.json({ conversations: [] })
      }
      throw e
    }

    const rbtProfileIds = profilesWithMessages.map((p) => p.rbtProfileId)

    if (rbtProfileIds.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    const profiles = await prisma.rBTProfile.findMany({
      where: { id: { in: rbtProfileIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    let rbtMessageCounts: Array<{ rbtProfileId: string; _count: { id: number } }> = []
    let lastMessage: Array<{ rbtProfileId: string; createdAt: Date; message: string }> = []
    try {
      ;[rbtMessageCounts, lastMessage] = await Promise.all([
        prisma.rBTMessage.groupBy({
          by: ['rbtProfileId'],
          where: {
            rbtProfileId: { in: rbtProfileIds },
            senderRole: 'RBT',
          },
          _count: { id: true },
        }),
        prisma.rBTMessage.findMany({
          where: { rbtProfileId: { in: rbtProfileIds } },
          orderBy: { createdAt: 'desc' },
          distinct: ['rbtProfileId'],
          select: { rbtProfileId: true, createdAt: true, message: true },
        }),
      ])
    } catch (e) {
      if (isPrismaTableError(e)) {
        console.warn('[admin/messages] GET: rbt_messages groupBy/findMany failed, returning basic list')
        const conversations = profiles.map((p) => ({
          rbtProfileId: p.id,
          name: `${p.firstName} ${p.lastName}`.trim(),
          email: p.email,
          unreadCount: 0,
          lastMessage: null as string | null,
          lastMessageAt: null as string | null,
        }))
        return NextResponse.json({ conversations })
      }
      throw e
    }

    const unreadByProfile: Record<string, number> = {}
    for (const u of rbtMessageCounts) {
      unreadByProfile[u.rbtProfileId] = u._count.id
    }
    const lastByProfile: Record<string, { createdAt: Date; message: string }> = {}
    for (const m of lastMessage) {
      if (!lastByProfile[m.rbtProfileId]) {
        lastByProfile[m.rbtProfileId] = {
          createdAt: m.createdAt,
          message: m.message.slice(0, 80),
        }
      }
    }

    const conversations = profiles.map((p) => ({
      rbtProfileId: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email,
      unreadCount: unreadByProfile[p.id] ?? 0,
      lastMessage: lastByProfile[p.id]?.message ?? null,
      lastMessageAt: lastByProfile[p.id]?.createdAt?.toISOString() ?? null,
    }))

    conversations.sort((a, b) => {
      const aTime = a.lastMessageAt ?? ''
      const bTime = b.lastMessageAt ?? ''
      return bTime.localeCompare(aTime)
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('[admin/messages] GET error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load conversations'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to load conversations' },
      { status: 500 }
    )
  }
}
