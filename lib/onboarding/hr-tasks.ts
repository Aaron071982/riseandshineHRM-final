import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { ONBOARDING_CATALOG } from '@/lib/onboarding/catalog'

const PDF_FOLDER = join(process.cwd(), 'onboarding-documents')

const HR_TASK_BASE_SELECT = {
  id: true,
  documentType: true,
  status: true,
  hrFileUrl: true,
  hrUploadedAt: true,
  btFileUrl: true,
  notes: true,
} as const

export type HrDocumentTaskRow = {
  id: string
  documentType: string
  status: string
  hrFileUrl: string | null
  hrUploadedAt: Date | null
  btFileUrl: string | null
  notes: string | null
  emailSent?: boolean
  emailSentAt?: Date | null
}

function isMissingEmailColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('email_sent') ||
    msg.includes('emailSent') ||
    (msg.includes('column') && msg.includes('does not exist'))
  )
}

export function isMissingHrDocumentTasksTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('hr_document_tasks') &&
    (msg.includes('does not exist') || msg.includes('relation') && msg.includes('not exist'))
  )
}

/** Load HR tasks; works before email_sent / email_sent_at columns are migrated. */
export async function listHrDocumentTasksForRbt(rbtProfileId: string): Promise<HrDocumentTaskRow[]> {
  try {
    return await prisma.hRDocumentTask.findMany({
      where: { rbtProfileId },
      orderBy: { createdAt: 'asc' },
      select: {
        ...HR_TASK_BASE_SELECT,
        emailSent: true,
        emailSentAt: true,
      },
    })
  } catch (err) {
    if (!isMissingEmailColumnError(err)) throw err
    return prisma.hRDocumentTask.findMany({
      where: { rbtProfileId },
      orderBy: { createdAt: 'asc' },
      select: HR_TASK_BASE_SELECT,
    })
  }
}

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
