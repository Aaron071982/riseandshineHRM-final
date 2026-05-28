import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.rbtProfileId || (user.role !== 'RBT' && user.role !== 'CANDIDATE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { documentId } = await params
    const doc = await prisma.onboardingDocument.findFirst({
      where: { id: documentId, isActive: true },
      select: { pdfData: true, pdfUrl: true, slug: true, title: true },
    })

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (doc.pdfUrl) {
      return NextResponse.redirect(doc.pdfUrl)
    }

    if (!doc.pdfData) {
      return NextResponse.json({ error: 'PDF not available' }, { status: 404 })
    }

    const buf = Buffer.from(doc.pdfData, 'base64')
    const filename = `${doc.slug || 'document'}.pdf`

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    console.error('[onboarding/document/pdf]', e)
    return NextResponse.json({ error: 'Failed to load PDF' }, { status: 500 })
  }
}
