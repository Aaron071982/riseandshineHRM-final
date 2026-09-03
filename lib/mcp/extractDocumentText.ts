import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'

/**
 * Extract searchable text from PDF or plain text. Never OCR images.
 * DOCX/images refuse so callers can fall back to link mode.
 *
 * PDFs use `unpdf` (serverless-safe) — not browser pdf.js, which crashes
 * on Vercel with `DOMMatrix is not defined`.
 */
export async function extractDocumentText(input: {
  bytes: Buffer
  contentType?: string | null
  fileName?: string | null
}): Promise<{ text: string } | { error: string }> {
  const name = (input.fileName ?? '').toLowerCase()
  const type = (input.contentType ?? '').toLowerCase()

  if (type.startsWith('image/') || /\.(png|jpe?g|heic|heif|gif|webp)$/i.test(name)) {
    return { error: 'Image files are not extracted as text (no OCR). Use mode=link.' }
  }

  if (type.includes('text/plain') || name.endsWith('.txt')) {
    return { text: input.bytes.toString('utf8').slice(0, 200_000) }
  }

  if (
    type.includes('wordprocessingml') ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) {
    return {
      error:
        'Word documents are not extracted as text via the connector. Use mode=link or upload a PDF.',
    }
  }

  if (type.includes('pdf') || name.endsWith('.pdf') || isPdfMagic(input.bytes)) {
    try {
      const text = await extractPdfText(input.bytes)
      if (!text.trim()) {
        return {
          error:
            "Couldn't extract text from this PDF (it may be scanned/image-only). Use mode=link — OCR is not used.",
        }
      }
      return { text: text.slice(0, 200_000) }
    } catch (err) {
      console.error('[mcp] PDF text extraction failed', err)
      return {
        error:
          "Couldn't extract text from this PDF — open via link (mode=link) or in the app.",
      }
    }
  }

  return { error: 'Unsupported file type for text extraction. Use mode=link.' }
}

function isPdfMagic(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString('utf8') === '%PDF-'
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  // Copy into a fresh Uint8Array — some PDF loaders detach/transfer the buffer.
  const data = new Uint8Array(bytes)
  const pdf = await getDocumentProxy(data)
  const { text } = await extractText(pdf, { mergePages: true })
  if (Array.isArray(text)) {
    return text.join('\n\n').replace(/\s+/g, ' ').trim()
  }
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}
