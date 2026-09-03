import 'server-only'

/**
 * Extract searchable text from PDF or plain text. Never OCR images.
 * DOCX/images return null so callers can refuse or fall back to link mode.
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
    const text = await extractPdfText(input.bytes)
    if (!text.trim()) {
      return {
        error:
          'Could not extract text from this PDF (it may be scanned). Use mode=link — OCR is not used.',
      }
    }
    return { text: text.slice(0, 200_000) }
  }

  return { error: 'Unsupported file type for text extraction. Use mode=link.' }
}

function isPdfMagic(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString('utf8') === '%PDF-'
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  const pages: string[] = []
  const maxPages = Math.min(pdf.numPages, 40)
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(line)
  }
  return pages.join('\n\n').replace(/\s+/g, ' ').trim()
}
