import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Download a completed Social Security card upload (admin only).
 * File is stored as a data URL on the onboarding task.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id: rbtProfileId, taskId } = await params

    const task = await prisma.onboardingTask.findFirst({
      where: {
        id: taskId,
        rbtProfileId,
        taskType: 'SOCIAL_SECURITY_DOCUMENT',
        isCompleted: true,
      },
      include: { rbtProfile: { select: { lastName: true } } },
    })

    if (!task?.uploadUrl || !task.uploadUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'No Social Security upload found for this task' }, { status: 404 })
    }

    const matches = task.uploadUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!matches) {
      return NextResponse.json({ error: 'Invalid stored file format' }, { status: 400 })
    }

    const mimeType = matches[1]
    const base64 = matches[2]
    const buffer = Buffer.from(base64, 'base64')

    let ext = 'bin'
    if (mimeType.includes('pdf')) ext = 'pdf'
    else if (mimeType.includes('png')) ext = 'png'
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg'

    const safeLast = (task.rbtProfile?.lastName || 'rbt').replace(/[^a-zA-Z0-9-_]/g, '_')
    const filename = `social-security-card_${safeLast}.${ext}`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[admin] SSN task download error:', e)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
