import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveOnboardingPdfBytes } from '@/lib/onboarding/provision'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
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

    const buf = await resolveOnboardingPdfBytes(doc)
    if (!buf?.length) {
      return NextResponse.json({ error: 'PDF not available' }, { status: 404 })
    }

    const filename = `${doc.slug || 'document'}.pdf`
    const download = request.nextUrl.searchParams.get('download') === '1'
    const disposition = download ? 'attachment' : 'inline'

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename.replace(/"/g, '')}"`,
        'Content-Length': buf.length.toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[onboarding/document/pdf]', e)
    return NextResponse.json({ error: 'Failed to load PDF' }, { status: 500 })
  }
}
