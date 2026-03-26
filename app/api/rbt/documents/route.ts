import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** GET: Return myDocuments, companyDocuments, and forms for the current RBT. */
export async function GET() {
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

    const rbtProfileId = user.rbtProfileId

    let myDocs: Array<{ id: string; fileName: string; fileType: string; uploadedAt: Date; fileData?: string | null }> = []
    let completionsWithDocs: Array<{ id: string; documentId: string; status: string; completedAt: Date | null; signedPdfUrl: string | null; document: { title: string } }> = []
    let formDocs: Array<{ id: string; title: string; slug: string; type: string; pdfUrl: string | null }> = []

    try {
      myDocs = await prisma.rBTDocument.findMany({
        where: { rbtProfileId },
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          uploadedAt: true,
          fileData: true,
        },
      })
    } catch (e) {
      console.error('[rbt/documents] myDocs error:', e)
    }

    try {
      completionsWithDocs = await prisma.onboardingCompletion.findMany({
        where: { rbtProfileId, status: 'COMPLETED' },
        include: { document: { select: { title: true } } },
        orderBy: { completedAt: 'desc' },
      })
    } catch (e) {
      console.error('[rbt/documents] completions error:', e)
    }

    try {
      formDocs = await prisma.onboardingDocument.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, title: true, slug: true, type: true, pdfUrl: true },
      })
    } catch (e) {
      console.error('[rbt/documents] formDocs error:', e)
    }

    const myDocuments = myDocs.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileType: d.fileType,
      uploadedAt: d.uploadedAt,
      size: d.fileData != null && d.fileData.length > 0 ? Math.ceil((d.fileData.length * 3) / 4) : null,
    }))

    const companyDocuments = completionsWithDocs.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      title: c.document.title,
      status: c.status,
      completedAt: c.completedAt,
      signedPdfUrl: c.signedPdfUrl,
    }))

    const forms = formDocs.map((d) => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      type: d.type,
      pdfUrl: d.pdfUrl,
    }))

    return NextResponse.json({
      myDocuments,
      companyDocuments,
      forms,
    })
  } catch (error) {
    console.error('[rbt/documents] GET error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load documents'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to load documents' },
      { status: 500 }
    )
  }
}
