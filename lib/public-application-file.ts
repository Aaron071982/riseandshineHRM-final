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
  return null
}

/** Prefer file.type when reliable; otherwise extension (and treat octet-stream as unreliable). */
export function effectiveFileMime(file: File): string {
  const t = (file.type || '').trim()
  if (t && t !== 'application/octet-stream') return t
  return inferMimeFromFileName(file.name) || t || ''
}
