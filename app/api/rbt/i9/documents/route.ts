import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { mimeTypeFromFileName } from '@/lib/rbtDocumentsSync'
import { I9_SUPPORTING_DOCUMENT_TYPE } from '@/lib/compliance/i9Status'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 6
const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'heic', 'webp'])

/** Employee uploads identity / work-authorization documents for their Form I-9 (appended, never replaced). */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.rbtProfileId || (user.role !== 'RBT' && user.role !== 'CANDIDATE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) {
      return NextResponse.json({ error: 'Choose at least one file' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Upload up to ${MAX_FILES} files at a time` }, { status: 400 })
    }
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: `${file.name}: upload a PDF or photo (PDF, JPG, PNG, HEIC)` },
          { status: 400 }
        )
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name}: files must be under 10MB` }, { status: 400 })
      }
    }

    const now = new Date()
    const uploaded: { path: string; fileName: string; fileType: string }[] = []
    for (const [i, file] of files.entries()) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const path = `rbts/${user.rbtProfileId}/i9-documents/${now.getTime()}-${i}.${ext}`
      const fileType = file.type || mimeTypeFromFileName(file.name)
      const { error } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: fileType, upsert: false })
      if (error) {
        console.error('[rbt/i9/documents] storage upload failed', error)
        return NextResponse.json({ error: 'Upload failed — please try again' }, { status: 500 })
      }
      uploaded.push({ path, fileName: file.name, fileType })
    }

    await prisma.$transaction([
      ...uploaded.map((u) =>
        prisma.rBTDocument.create({
          data: {
            rbtProfileId: user.rbtProfileId!,
            fileName: u.fileName,
            fileType: u.fileType,
            fileData: '',
            filePath: u.path,
            documentType: I9_SUPPORTING_DOCUMENT_TYPE,
          },
        })
      ),
      prisma.rBTAuditLog.create({
        data: {
          rbtProfileId: user.rbtProfileId,
          auditType: 'COMPLIANCE',
          dateTime: now,
          notes: `Form I-9 supporting document(s) uploaded by employee: ${uploaded.length} file(s)`,
          createdBy: user.email || 'RBT',
        },
      }),
    ])

    return NextResponse.json({ success: true, count: uploaded.length })
  } catch (e) {
    console.error('[rbt/i9/documents]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
