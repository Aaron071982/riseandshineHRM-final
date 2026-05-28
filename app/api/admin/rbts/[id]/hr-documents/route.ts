import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureHrDocumentTasksForRbt } from '@/lib/onboarding/hr-tasks'
import { ONBOARDING_CATALOG } from '@/lib/onboarding/catalog'

export const dynamic = 'force-dynamic'

const HR_SLUGS = ONBOARDING_CATALOG.filter((e) => e.category === 'HR_INITIATED')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id: rbtProfileId } = await params
  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await ensureHrDocumentTasksForRbt(rbtProfileId)

  const tasks = await prisma.hRDocumentTask.findMany({
    where: { rbtProfileId },
    orderBy: { createdAt: 'asc' },
  })

  const catalogBySlug = new Map(HR_SLUGS.map((e) => [e.slug, e]))

  return NextResponse.json({
    tasks: tasks
      .filter((t) => catalogBySlug.has(t.documentType))
      .map((t) => {
        const cat = catalogBySlug.get(t.documentType)!
        return {
          id: t.id,
          documentType: t.documentType,
          title: cat.title,
          stepNumber: cat.stepNumber,
          status: t.status,
          hrFileUrl: t.hrFileUrl,
          hrUploadedAt: t.hrUploadedAt?.toISOString() ?? null,
          emailSent: t.emailSent,
          emailSentAt: t.emailSentAt?.toISOString() ?? null,
          btFileUrl: t.btFileUrl,
          notes: t.notes,
        }
      }),
  })
}
