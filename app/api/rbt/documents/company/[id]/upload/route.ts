import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { isCompanyDocTestEmail } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response
  const rbtProfileId = auth.user.rbtProfileId!
  const { id } = await params

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const row = await prisma.companyDocumentRecipient.findUnique({
    where: { companyDocumentId_rbtProfileId: { companyDocumentId: id, rbtProfileId } },
    include: { companyDocument: true },
  })
  if (!row || row.rbtProfileId !== rbtProfileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (row.companyDocument.isTest && !isCompanyDocTestEmail(auth.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (row.companyDocument.documentType !== 'DOWNLOAD_UPLOAD') {
    return NextResponse.json({ error: 'This document does not accept uploads' }, { status: 400 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() || 'bin'
  const path = `company-documents/submissions/${rbtProfileId}/${id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
  })
  if (error) {
    console.error('[company-doc upload submit]', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const now = new Date()
  const updated = await prisma.companyDocumentRecipient.update({
    where: { id: row.id },
    data: {
      status: 'SUBMITTED',
      uploadedFileUrl: path,
      submittedAt: now,
      viewedAt: row.viewedAt ?? now,
    },
  })

  return NextResponse.json({
    recipient: {
      id: updated.id,
      status: updated.status,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
    },
  })
}
