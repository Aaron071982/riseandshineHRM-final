import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const btFileUrl = typeof body.btFileUrl === 'string' ? body.btFileUrl.trim() : ''

    if (!btFileUrl) {
      return NextResponse.json({ error: 'Missing btFileUrl' }, { status: 400 })
    }

    const hrTask = await prisma.hRDocumentTask.findUnique({
      where: { id },
    })

    if (!hrTask) {
      return NextResponse.json({ error: 'HR task not found' }, { status: 404 })
    }

    if (hrTask.rbtProfileId !== user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (hrTask.status !== 'PENDING_BT') {
      return NextResponse.json(
        { error: 'HR task is not ready for BT upload' },
        { status: 400 }
      )
    }

    const updated = await prisma.hRDocumentTask.update({
      where: { id },
      data: {
        btFileUrl,
        btUploadedAt: new Date(),
        status: 'PENDING_HR_SIGNOFF',
      },
    })

    return NextResponse.json({ hrTask: updated })
  } catch (error) {
    console.error('hr-tasks bt-upload error:', error)
    return NextResponse.json({ error: 'Failed to record upload' }, { status: 500 })
  }
}
