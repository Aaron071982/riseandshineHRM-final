import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAdminSession } from '@/lib/auth'
import { TRAINING_MATERIALS_BUCKET } from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'doc',
  'docx',
  'txt',
])

function safeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 })
  }

  const mime = (file.type || '').toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_TYPES.has(mime) && !ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: 'Allowed: PDF, Word, images, or plain text' },
      { status: 400 }
    )
  }

  const moduleId = String(form.get('moduleId') ?? 'unassigned').replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  )
  const path = `${moduleId}/${randomUUID()}-${safeFileName(file.name)}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from(TRAINING_MATERIALS_BUCKET)
    .upload(path, buffer, {
      contentType: mime || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('[org-training upload]', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  return NextResponse.json({ storageObjectPath: path })
}
