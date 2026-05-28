import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { ONBOARDING_CATALOG } from '@/lib/onboarding/catalog'

const PDF_FOLDER = join(process.cwd(), 'onboarding-documents')

/** Create HR document tasks for each HR_INITIATED catalog step. */
export async function ensureHrDocumentTasksForRbt(rbtProfileId: string): Promise<void> {
  const slugs = ONBOARDING_CATALOG.filter((e) => e.category === 'HR_INITIATED').map((e) => e.slug)

  for (const documentType of slugs) {
    const existing = await prisma.hRDocumentTask.findFirst({
      where: { rbtProfileId, documentType },
    })
    if (!existing) {
      await prisma.hRDocumentTask.create({
        data: { rbtProfileId, documentType, status: 'PENDING_HR' },
      })
    }
  }
}

/** Load template PDF from disk only (avoids multi‑MB base64 from DB exhausting memory). */
export async function loadCatalogPdfBytes(slug: string): Promise<Uint8Array | null> {
  const entry = ONBOARDING_CATALOG.find((e) => e.slug === slug)
  if (!entry?.file) return null

  const filePath = join(PDF_FOLDER, entry.file)
  if (!existsSync(filePath)) {
    console.error(`[hr-tasks] Missing PDF file: ${filePath}`)
    return null
  }
  const buffer = await readFile(filePath)
  if (buffer.length > 15 * 1024 * 1024) {
    console.error(`[hr-tasks] PDF too large: ${entry.file} (${buffer.length} bytes)`)
    return null
  }
  return new Uint8Array(buffer)
}
