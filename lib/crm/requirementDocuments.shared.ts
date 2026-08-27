import { CRM_CLIENT_REQUIREMENTS_PREFIX } from '@/lib/constants'

/** Vercel serverless request body cap — files above this must use direct-to-Supabase upload. */
export const VERCEL_UPLOAD_BODY_LIMIT_BYTES = Math.floor(4.5 * 1024 * 1024)

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

/** True when fileUrl is a private storage path (not an external http(s) link). */
export function isStoredRequirementPath(
  fileUrl: string | null | undefined
): boolean {
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
    return {
      ok: false,
      error: 'Unsupported file type — use PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, or TXT',
    }
  }
  return { ok: true }
}

export function assertRequirementStoragePath(
  storagePath: string,
  clientId: string,
  requirementKey: string
): { ok: true } | { ok: false; error: string } {
  const prefix = `${CRM_CLIENT_REQUIREMENTS_PREFIX}/${clientId}/`
  if (!storagePath.startsWith(prefix)) {
    return { ok: false, error: 'Invalid storage path for this client' }
  }
  const safeKey = requirementKey.replace(/[^a-z0-9_-]/gi, '_')
  const rest = storagePath.slice(prefix.length)
  if (!rest.startsWith(`${safeKey}-`)) {
    return { ok: false, error: 'Storage path does not match this requirement' }
  }
  return { ok: true }
}

export type RequirementUploadRequirement = {
  id: string
  key: string
  serviceClientId: string
  type: string
  deletedAt: Date | null
}

export function isUploadableDocumentRequirement(
  requirement: RequirementUploadRequirement | null
): requirement is RequirementUploadRequirement & { type: 'DOCUMENT' } {
  return (
    !!requirement &&
    requirement.deletedAt == null &&
    requirement.type === 'DOCUMENT'
  )
}
