import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await prisma.session.delete({
      where: { id: sessionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error signing out session:', error)
    return NextResponse.json({ error: 'Failed to sign out session' }, { status: 500 })
  }
}
