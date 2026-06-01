import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { regenerateLs54HrPdfFromTask } from '@/lib/onboarding/ls54-hr-send'
import { LS54_SLUG } from '@/lib/onboarding/ls54'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const adminUser = auth.user!

    const { id: rbtProfileId, taskId } = await params

    const task = await prisma.hRDocumentTask.findFirst({
      where: { id: taskId, rbtProfileId, documentType: LS54_SLUG },
      select: { id: true, status: true, notes: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (task.status === 'PENDING_HR') {
      return NextResponse.json(
        { error: 'Use Send to RBT for documents not yet sent' },
        { status: 400 }
      )
    }

    const generated = await regenerateLs54HrPdfFromTask(taskId, rbtProfileId)
    if (!generated.ok) {
      return NextResponse.json(
        { error: generated.error, details: generated.details },
        { status: 400 }
      )
    }

    const now = new Date()
    const existingMeta = (() => {
      try {
        return task.notes ? JSON.parse(task.notes) : {}
      } catch {
        return {}
      }
    })()

    const formMeta = {
      ...existingMeta,
      ...generated.formMeta,
      regeneratedAt: now.toISOString(),
      regeneratedBy: adminUser.email ?? adminUser.id,
    }

    const updated = await prisma.hRDocumentTask.update({
      where: { id: taskId },
      data: {
        hrFileUrl: generated.storagePath,
        hrUploadedAt: now,
        notes: JSON.stringify(formMeta),
      },
      select: {
        id: true,
        status: true,
        hrFileUrl: true,
        hrUploadedAt: true,
        notes: true,
      },
    })

    return NextResponse.json({
      success: true,
      hrTask: {
        ...updated,
        hrUploadedAt: updated.hrUploadedAt?.toISOString() ?? null,
      },
    })
  } catch (err) {
    console.error('[hr-documents/regenerate]', err)
    return NextResponse.json({ error: 'Failed to regenerate LS-54 PDF' }, { status: 500 })
  }
}
