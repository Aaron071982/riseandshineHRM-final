import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import {
  emailCompanyDocRecipients,
  resolveCompanyDocRecipients,
  statusCounts,
} from '@/lib/company-documents/distribute'
import type { CompanyDocumentType } from '@prisma/client'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = new Set(['ACKNOWLEDGMENT', 'DOWNLOAD_UPLOAD', 'VIEW_ONLY'])

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') // 'test' | 'live' | 'all'
  const where =
    filter === 'test'
      ? { isTest: true }
      : filter === 'live'
        ? { isTest: false }
        : {}

  const docs = await prisma.companyDocument.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      recipients: { select: { status: true } },
      _count: { select: { recipients: true } },
    },
  })

  return NextResponse.json({
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      fileType: d.fileType,
      documentType: d.documentType,
      isActive: d.isActive,
      isTest: d.isTest,
      createdAt: d.createdAt.toISOString(),
      uploadedBy: d.uploadedBy,
      recipientCount: d._count.recipients,
      counts: statusCounts(d.recipients),
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response
  const user = auth.user!

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const form = await request.formData()
  const title = String(form.get('title') ?? '').trim()
  const description = String(form.get('description') ?? '').trim() || null
  const documentTypeRaw = String(form.get('documentType') ?? '').trim().toUpperCase()
  const isTest = String(form.get('isTest') ?? '') === 'true' || form.get('isTest') === 'on'
  const file = form.get('file')

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!ALLOWED_TYPES.has(documentTypeRaw)) {
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'PDF or PNG file is required' }, { status: 400 })
  }

  const mime = (file.type || '').toLowerCase()
  const nameLower = file.name.toLowerCase()
  const isPdf = mime === 'application/pdf' || nameLower.endsWith('.pdf')
  const isPng = mime === 'image/png' || nameLower.endsWith('.png')
  if (!isPdf && !isPng) {
    return NextResponse.json({ error: 'Only PDF or PNG files are allowed' }, { status: 400 })
  }

  const recipients = await resolveCompanyDocRecipients(isTest)
  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error: isTest
          ? 'Test account RBT profile not found for aaronsiam22@gmail.com'
          : 'No actively working RBTs with email found',
      },
      { status: 400 }
    )
  }

  const ext = isPdf ? 'pdf' : 'png'
  const path = `company-documents/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: isPdf ? 'application/pdf' : 'image/png',
    upsert: false,
  })
  if (uploadError) {
    console.error('[company-docs upload]', uploadError)
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
  }

  const documentType = documentTypeRaw as CompanyDocumentType
  const doc = await prisma.companyDocument.create({
    data: {
      title,
      description,
      fileUrl: path,
      fileType: isPdf ? 'pdf' : 'png',
      documentType,
      uploadedById: user.id,
      isTest,
      recipients: {
        create: recipients.map((r) => ({
          rbtProfileId: r.id,
          status: 'PENDING',
        })),
      },
    },
  })

  const emailed = await emailCompanyDocRecipients({
    recipients,
    title,
    documentType,
    isTest,
    companyDocumentId: doc.id,
  })

  return NextResponse.json(
    {
      document: {
        id: doc.id,
        title: doc.title,
        isTest: doc.isTest,
        documentType: doc.documentType,
        recipientCount: recipients.length,
        emailed,
      },
    },
    { status: 201 }
  )
}
