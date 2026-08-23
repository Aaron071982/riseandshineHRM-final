import { randomUUID } from 'crypto'
import {
  CRM_CLIENT_REQUIREMENTS_PREFIX,
  STORAGE_BUCKET,
} from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'

export const MAX_REQUIREMENT_DOCUMENT_BYTES = 25 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'heic',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
])

function safeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

export function isStoredRequirementPath(
  fileUrl: string | null | undefined
): fileUrl is string {
  if (!fileUrl?.trim()) return false
  const path = fileUrl.trim()
  return (
    path.startsWith(`${CRM_CLIENT_REQUIREMENTS_PREFIX}/`) ||
    path.startsWith('client-services/')
  )
}

export function requirementDownloadFileName(input: {
  fileName: string | null
  fileUrl: string | null
  label: string
}): string {
  if (input.fileName?.trim()) return input.fileName.trim()
  const fromPath = input.fileUrl?.split('/').pop()
  if (fromPath?.includes('.')) return fromPath
  return `${input.label.replace(/\W+/g, '_') || 'document'}.pdf`
}

export function validateRequirementDocumentFile(file: {
  name: string
  size: number
  type: string
}): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: 'Empty file' }
  if (file.size > MAX_REQUIREMENT_DOCUMENT_BYTES) {
    return { ok: false, error: 'File must be 25 MB or smaller' }
  }
  const type = (file.type || 'application/octet-stream').toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_TYPES.has(type) && !ALLOWED_EXTENSIONS.has(ext ?? '')) {
    return { ok: false, error: 'Unsupported file type' }
  }
  return { ok: true }
}

export function buildRequirementStoragePath(input: {
  clientId: string
  requirementKey: string
  fileName: string
}): string {
  const ext = input.fileName.split('.').pop()?.toLowerCase() || 'bin'
  const safeKey = input.requirementKey.replace(/[^a-z0-9_-]/gi, '_')
  const id = randomUUID()
  return `${CRM_CLIENT_REQUIREMENTS_PREFIX}/${input.clientId}/${safeKey}-${id}.${ext}`
}

export async function uploadRequirementDocument(input: {
  clientId: string
  requirementKey: string
  fileName: string
  contentType: string
  bytes: Buffer
}): Promise<{
  storagePath: string
  fileName: string
  contentType: string
  sizeBytes: number
}> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const storagePath = buildRequirementStoragePath(input)
  const contentType = input.contentType || 'application/octet-stream'
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType,
      upsert: false,
    })
  if (error) {
    console.error('[crm-requirements] upload failed', error)
    throw new Error('Upload failed')
  }
  return {
    storagePath,
    fileName: input.fileName,
    contentType,
    sizeBytes: input.bytes.length,
  }
}

export async function downloadRequirementDocument(
  storagePath: string
): Promise<{ bytes: Buffer; contentType: string }> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(storagePath.trim())
  if (error || !data) {
    console.error('[crm-requirements] download failed', error)
    throw new Error('Download failed')
  }
  const bytes = Buffer.from(await data.arrayBuffer())
  return {
    bytes,
    contentType: data.type || 'application/octet-stream',
  }
}
