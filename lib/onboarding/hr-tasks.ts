import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
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

function prismaCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function isMissingEmailColumnError(err: unknown): boolean {
  const msg = errorMessage(err)
  return (
    msg.includes('email_sent') ||
    msg.includes('emailSent') ||
    (msg.includes('column') && msg.includes('does not exist'))
  )
}

/** True only when the table itself is missing — not a missing column on an existing table. */
export function isMissingHrDocumentTasksTableError(err: unknown): boolean {
  const msg = errorMessage(err)
  if (msg.includes('column') && msg.includes('does not exist')) return false
  const code = prismaCode(err)
  return (
    code === 'P2021' ||
    (msg.includes('hr_document_tasks') &&
      msg.includes('does not exist') &&
      !msg.includes('column'))
  )
}

export async function hrDocumentTasksTableExists(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'hr_document_tasks'
    ) AS "exists"
  `
  return rows[0]?.exists === true
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

async function ensureHrDocumentTaskViaRaw(rbtProfileId: string, documentType: string): Promise<void> {
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM hr_document_tasks
    WHERE "rbtProfileId" = ${rbtProfileId} AND "documentType" = ${documentType}
    LIMIT 1
  `
  if (existing.length > 0) return

  const id = randomUUID()
  try {
    await prisma.$executeRaw`
      INSERT INTO hr_document_tasks (
        id, "rbtProfileId", "documentType", status, "emailSent", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${rbtProfileId}, ${documentType},
        'PENDING_HR'::"HRTaskStatus", false, NOW(), NOW()
      )
    `
  } catch (err) {
    if (!isMissingEmailColumnError(err)) throw err
    await prisma.$executeRaw`
      INSERT INTO hr_document_tasks (
        id, "rbtProfileId", "documentType", status, "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${rbtProfileId}, ${documentType},
        'PENDING_HR'::"HRTaskStatus", NOW(), NOW()
      )
    `
  }
}

/** Create HR document tasks for each HR_INITIATED catalog step. */
export async function ensureHrDocumentTasksForRbt(rbtProfileId: string): Promise<void> {
  const slugs = ONBOARDING_CATALOG.filter((e) => e.category === 'HR_INITIATED').map((e) => e.slug)

  for (const documentType of slugs) {
    try {
      const existing = await prisma.hRDocumentTask.findFirst({
        where: { rbtProfileId, documentType },
        select: { id: true },
      })
      if (!existing) {
        await prisma.hRDocumentTask.create({
          data: { rbtProfileId, documentType, status: 'PENDING_HR' },
        })
      }
    } catch (err) {
      if (isMissingEmailColumnError(err)) {
        await ensureHrDocumentTaskViaRaw(rbtProfileId, documentType)
        continue
      }
      if (isMissingHrDocumentTasksTableError(err)) throw err
      await ensureHrDocumentTaskViaRaw(rbtProfileId, documentType)
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
