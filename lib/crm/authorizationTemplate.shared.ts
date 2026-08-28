import {
  CRM_CLIENT_AUTH_TEMPLATES_PREFIX,
} from '@/lib/constants'

/** Vercel serverless request body cap — files above this must use direct-to-Supabase upload. */
export const VERCEL_AUTH_TEMPLATE_UPLOAD_BODY_LIMIT_BYTES = Math.floor(4.5 * 1024 * 1024)

export const MAX_AUTH_TEMPLATE_BYTES = 25 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'])

export function isStoredAuthTemplatePath(
  storagePath: string | null | undefined
): boolean {
  if (!storagePath?.trim()) return false
  return storagePath.trim().startsWith(`${CRM_CLIENT_AUTH_TEMPLATES_PREFIX}/`)
}

export function authTemplateDownloadFileName(input: {
  fileName: string | null
  storagePath: string | null
}): string {
  if (input.fileName?.trim()) return input.fileName.trim()
  const fromPath = input.storagePath?.split('/').pop()
  if (fromPath?.includes('.')) return fromPath
  return 'authorization-template.pdf'
}

export function validateAuthTemplateFile(file: {
  name: string
  size: number
  type: string
}): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) {
    return { ok: false, error: 'File is empty' }
  }
  if (file.size > MAX_AUTH_TEMPLATE_BYTES) {
    return {
      ok: false,
      error: `File must be ${MAX_AUTH_TEMPLATE_BYTES / (1024 * 1024)} MB or smaller`,
    }
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type?.trim().toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_TYPES.has(type)) {
    return {
      ok: false,
      error: 'Allowed types: PDF, Word, Excel, or plain text',
    }
  }
  return { ok: true }
}

export function assertAuthTemplateStoragePath(input: {
  clientId: string
  storagePath: string
}): void {
  const path = input.storagePath.trim()
  const prefix = `${CRM_CLIENT_AUTH_TEMPLATES_PREFIX}/${input.clientId}/`
  if (!path.startsWith(prefix)) {
    throw new Error('Invalid storage path for authorization template')
  }
}
