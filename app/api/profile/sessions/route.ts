import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth'

export async function DELETE(request: NextRequest) {
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

    await prisma.session.deleteMany({
      where: { userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error signing out all sessions:', error)
    return NextResponse.json({ error: 'Failed to sign out sessions' }, { status: 500 })
  }
}
