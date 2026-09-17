import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { ensureBcbaOnboardingCompletions } from '@/lib/onboarding/bcbaProgress'

function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return base || `doc-${Date.now()}`
}

export async function GET() {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const documents = await prisma.bcbaOnboardingDocument.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ documents })
  } catch (e) {
    console.error('[admin/bcba-onboarding-documents GET]', e)
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 })
  }
}

/** Create a new BCBA onboarding document (JSON) or upload PDF (multipart). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const documentId = String(form.get('documentId') || '')
      const file = form.get('file')
      if (!documentId || !(file instanceof File)) {
        return NextResponse.json({ error: 'documentId and file are required' }, { status: 400 })
      }
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'PDF required' }, { status: 400 })
      }
      const pdfData = Buffer.from(await file.arrayBuffer()).toString('base64')
      const document = await prisma.bcbaOnboardingDocument.update({
        where: { id: documentId },
        data: { pdfData, pdfUrl: null },
      })
      return NextResponse.json({ document })
    }

    const body = await request.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    const flowType = body?.flowType === 'UPLOAD' ? 'UPLOAD' : 'ESIGN'
    let slug = typeof body?.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(title)

    const existingSlug = await prisma.bcbaOnboardingDocument.findUnique({ where: { slug } })
    if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`

    const maxOrder = await prisma.bcbaOnboardingDocument.aggregate({
      _max: { displayOrder: true },
    })
    const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1

    const document = await prisma.bcbaOnboardingDocument.create({
      data: {
        title,
        slug,
        flowType,
        displayOrder,
        isRequired: body?.isRequired !== false,
        isActive: true,
      },
    })

    // Backfill completion rows for existing BCBAs
    const profiles = await prisma.bCBAProfile.findMany({ select: { id: true } })
    for (const p of profiles) {
      await ensureBcbaOnboardingCompletions(p.id)
    }

    return NextResponse.json({ document })
  } catch (e) {
    console.error('[admin/bcba-onboarding-documents POST]', e)
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const body = await request.json()
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const document = await prisma.bcbaOnboardingDocument.update({
      where: { id },
      data: {
        ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
        ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
        ...(typeof body.isRequired === 'boolean' ? { isRequired: body.isRequired } : {}),
        ...(typeof body.displayOrder === 'number' ? { displayOrder: body.displayOrder } : {}),
        ...(body.flowType === 'ESIGN' || body.flowType === 'UPLOAD'
          ? { flowType: body.flowType }
          : {}),
      },
    })
    return NextResponse.json({ document })
  } catch (e) {
    console.error('[admin/bcba-onboarding-documents PATCH]', e)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}
