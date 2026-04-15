/**
 * Mobile browsers often omit or misreport File.type (empty string, application/octet-stream).
 * Infer MIME from extension for public apply uploads.
 */
export function inferMimeFromFileName(fileName: string): string | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.heic')) return 'image/heic'
  if (lower.endsWith('.heif')) return 'image/heif'
  if (lower.endsWith('.webp')) return 'image/webp'
  return null
}

/** Normalize common browser MIME variants to a canonical value. */
export function normalizeMime(rawMime: string): string {
  const mime = rawMime.trim().toLowerCase()
  if (!mime) return ''
  if (mime === 'application/x-pdf') return 'application/pdf'
  if (mime === 'application/doc' || mime === 'application/vnd.ms-word') return 'application/msword'
  if (mime === 'image/jpg' || mime === 'image/pjpeg') return 'image/jpeg'
  return mime
}

/** Prefer file.type when reliable; otherwise extension (and treat octet-stream as unreliable). */
export function effectiveFileMime(file: File): string {
  const t = normalizeMime(file.type || '')
  if (t && t !== 'application/octet-stream') return t
  return normalizeMime(inferMimeFromFileName(file.name) || t || '')
}
