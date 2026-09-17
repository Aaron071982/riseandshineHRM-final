import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isAdmin = user.role === 'ADMIN'
    const isBcba = user.role === 'BCBA' && !!user.bcbaProfileId
    if (!isAdmin && !isBcba) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const doc = await prisma.bcbaOnboardingDocument.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, pdfData: true, pdfUrl: true, isActive: true },
    })
    if (!doc || (!doc.isActive && !isAdmin)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let bytes: Buffer | null = null
    if (doc.pdfData) {
      bytes = Buffer.from(doc.pdfData, 'base64')
    } else if (doc.pdfUrl) {
      const res = await fetch(doc.pdfUrl, { redirect: 'follow' })
      if (res.ok) bytes = Buffer.from(await res.arrayBuffer())
    }
    if (!bytes) {
      return NextResponse.json({ error: 'PDF not uploaded yet' }, { status: 404 })
    }

    const download = request.nextUrl.searchParams.get('download') === '1'
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${doc.title.replace(/[^a-z0-9-_]+/gi, '_')}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[bcba/onboarding/pdf]', e)
    return NextResponse.json({ error: 'Failed to load PDF' }, { status: 500 })
  }
}
