import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { canAuthorOrgTraining } from '@/lib/org-training/access'
import { fetchUserCrmRoles } from '@/lib/crm/access'
import { TRAINING_MATERIALS_BUCKET } from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** Docs/images: 10MB. Video (mp4/webm/mov): 200MB — also raise bucket limit in Supabase. */
const MAX_DOC_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

const DOC_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
])

const DOC_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'doc',
  'docx',
  'txt',
])

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi'])

function safeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await validateSession(token)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const crmRoles = await fetchUserCrmRoles(user.id)
  if (
    !canAuthorOrgTraining(user, {
      id: user.id,
      crmRoles,
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const mime = (file.type || '').toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const isVideo = VIDEO_TYPES.has(mime) || VIDEO_EXTENSIONS.has(ext)
  const isDoc = DOC_TYPES.has(mime) || DOC_EXTENSIONS.has(ext)

  if (!isVideo && !isDoc) {
    return NextResponse.json(
      {
        error:
          'Allowed: PDF, Word, images, plain text, or video (mp4, webm, mov)',
      },
      { status: 400 }
    )
  }

  const max = isVideo ? MAX_VIDEO_BYTES : MAX_DOC_BYTES
  if (file.size > max) {
    return NextResponse.json(
      {
        error: isVideo
          ? 'Video must be under 200MB'
          : 'File must be under 10MB',
      },
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
      contentType: mime || (isVideo ? 'video/mp4' : 'application/octet-stream'),
      upsert: false,
    })

  if (uploadError) {
    console.error('[org-training upload]', uploadError)
    return NextResponse.json(
      {
        error:
          uploadError.message?.includes('size') ||
          uploadError.message?.includes('Payload')
            ? 'Upload failed — raise the training-materials bucket file size limit in Supabase (e.g. 200MB for video).'
            : 'Upload failed',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ storageObjectPath: path, isVideo })
}
