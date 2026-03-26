import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendGenericEmail } from '@/lib/email'
import { generateNewMessageFromAdminEmail } from '@/lib/email/generators'
import { makePublicUrl } from '@/lib/baseUrl'

/** GET: List messages for one RBT (admin view). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rbtProfileId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { rbtProfileId } = await params

    const profile = await prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'RBT not found' }, { status: 404 })
    }

    const messages = await prisma.rBTMessage.findMany({
      where: { rbtProfileId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      profile: {
        rbtProfileId: profile.id,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        email: profile.email,
      },
      messages: messages.map((m) => ({
        id: m.id,
        senderRole: m.senderRole,
        message: m.message,
        isRead: m.isRead,
        createdAt: m.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[admin/messages/[rbtProfileId]] GET error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load messages'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to load messages' },
      { status: 500 }
    )
  }
}

/** POST: Admin sends a reply. Creates message, sends email to RBT. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rbtProfileId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { rbtProfileId } = await params

    const profile = await prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { id: true, firstName: true, email: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'RBT not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const created = await prisma.rBTMessage.create({
      data: {
        rbtProfileId,
        senderRole: 'ADMIN',
        message,
      },
    })

    const portalUrl = makePublicUrl('/rbt/dashboard')
    const { subject, html } = generateNewMessageFromAdminEmail(
      profile.firstName,
      portalUrl
    )
    if (profile.email) {
      await sendGenericEmail(profile.email, subject, html).catch((e) =>
        console.error('Send RBT message notification email failed:', e)
      )
    }

    return NextResponse.json({
      id: created.id,
      senderRole: created.senderRole,
      message: created.message,
      isRead: created.isRead,
      createdAt: created.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('[admin/messages/[rbtProfileId]] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
