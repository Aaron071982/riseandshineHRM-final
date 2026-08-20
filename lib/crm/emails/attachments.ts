import { randomUUID } from 'crypto'
import { CRM_EMAIL_ATTACHMENTS_PREFIX, STORAGE_BUCKET } from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'

export type EmailAttachmentRecord = {
  id: string
  fileName: string
  sizeBytes: number
  contentType: string
  storagePath: string
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
const MAX_ATTACHMENTS = 5

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

function safeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

export function validateEmailAttachmentFile(file: {
  name: string
  size: number
  type: string
}): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: 'Empty file' }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: 'File must be 15 MB or smaller' }
  }
  const type = (file.type || 'application/octet-stream').toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase()
  const okExt = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(
    ext ?? ''
  )
  if (!ALLOWED_TYPES.has(type) && !okExt) {
    return { ok: false, error: 'Unsupported file type' }
  }
  return { ok: true }
}

export async function uploadEmailAttachment(input: {
  clientId: string
  fileName: string
  contentType: string
  bytes: Buffer
}): Promise<EmailAttachmentRecord> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const id = randomUUID()
  const safe = safeFileName(input.fileName || 'attachment')
  const storagePath = `${CRM_EMAIL_ATTACHMENTS_PREFIX}/${input.clientId}/${id}-${safe}`

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: input.contentType || 'application/octet-stream',
      upsert: false,
    })
  if (error) {
    console.error('[crm-email] attachment upload failed', error)
    throw new Error('Upload failed')
  }

  return {
    id,
    fileName: input.fileName,
    sizeBytes: input.bytes.length,
    contentType: input.contentType || 'application/octet-stream',
    storagePath,
  }
}

export async function downloadEmailAttachment(
  storagePath: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!supabaseAdmin) return null
  if (!storagePath.startsWith(`${CRM_EMAIL_ATTACHMENTS_PREFIX}/`)) {
    return null
  }
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(storagePath)
  if (error || !data) {
    console.error('[crm-email] attachment download failed', error)
    return null
  }
  const ab = await data.arrayBuffer()
  return {
    bytes: Buffer.from(ab),
    contentType: data.type || 'application/octet-stream',
  }
}

export function parseAttachmentIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_ATTACHMENTS)
}

export { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES }
