import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { isCompanyDocTestEmail } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response
  const rbtProfileId = auth.user.rbtProfileId!
  const { id } = await params

  const row = await prisma.companyDocumentRecipient.findUnique({
    where: {
      companyDocumentId_rbtProfileId: { companyDocumentId: id, rbtProfileId },
    },
    include: { companyDocument: true },
  })

  if (!row || row.rbtProfileId !== rbtProfileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (row.companyDocument.isTest && !isCompanyDocTestEmail(auth.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!row.companyDocument.isActive) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(row.companyDocument.fileUrl)
  if (error || !data) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const buf = Buffer.from(await data.arrayBuffer())
  const contentType = row.companyDocument.fileType === 'png' ? 'image/png' : 'application/pdf'
  const safeName = row.companyDocument.title.replace(/[^a-zA-Z0-9._-]/g, '_')
  return new NextResponse(buf, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${safeName}.${row.companyDocument.fileType}"`,
      'Cache-Control': 'private, max-age=60',
    },
  })
}
