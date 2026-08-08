import { NextRequest, NextResponse } from 'next/server'
import { requireDocumentsAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { mimeTypeFromFileName } from '@/lib/rbtDocumentsSync'

export const dynamic = 'force-dynamic'

/** Download an RBT's uploaded completed file for a DOWNLOAD_UPLOAD company document. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  const auth = await requireDocumentsAdminSession()
  if (auth.response) return auth.response

  const { id: companyDocumentId, recipientId } = await params

  const row = await prisma.companyDocumentRecipient.findUnique({
    where: { id: recipientId },
    include: { companyDocument: true, rbtProfile: { select: { firstName: true, lastName: true } } },
  })

  if (!row || row.companyDocumentId !== companyDocumentId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const path = row.uploadedFileUrl?.trim()
  if (!path) {
    return NextResponse.json({ error: 'No submitted file for this recipient' }, { status: 404 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(path)
  if (error || !data) {
    console.error('[company-doc submission download]', error)
    return NextResponse.json({ error: 'Failed to download submission' }, { status: 500 })
  }

  const buf = Buffer.from(await data.arrayBuffer())
  const pathBase = path.split('/').pop() || 'submission.bin'
  const ext = pathBase.includes('.') ? pathBase.slice(pathBase.lastIndexOf('.')) : ''
  const safeTitle = row.companyDocument.title.replace(/[^a-zA-Z0-9._-]/g, '_') || 'submission'
  const safeName = `${row.rbtProfile.firstName}_${row.rbtProfile.lastName}_${safeTitle}`.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  )
  const fileName = `${safeName}${ext || '.bin'}`
  const contentType = mimeTypeFromFileName(fileName)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'private, no-store',
    },
  })
}
