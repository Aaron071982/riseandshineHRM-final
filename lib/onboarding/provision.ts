import { prisma } from '@/lib/prisma'
import { ONBOARDING_CATALOG } from '@/lib/onboarding/catalog'
import { ensureOnboardingCompletionsForRbt } from '@/lib/onboarding/progress'
import { ensureHrDocumentTasksForRbt } from '@/lib/onboarding/hr-tasks'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const PDF_FOLDER = join(process.cwd(), 'onboarding-documents')

async function loadPdfBase64(filename: string | null): Promise<string | null> {
  if (!filename) return null
  const filePath = join(PDF_FOLDER, filename)
  if (!existsSync(filePath)) return null
  const buffer = await readFile(filePath)
  return buffer.toString('base64')
}

/** Upsert all 32 catalog documents (global). */
export async function seedOnboardingCatalog(): Promise<{ upserted: number; missingFiles: string[] }> {
  const missingFiles: string[] = []
  let upserted = 0

  for (const entry of ONBOARDING_CATALOG) {
    let pdfData: string | null = null
    if (entry.file) {
      pdfData = await loadPdfBase64(entry.file)
      if (!pdfData) missingFiles.push(entry.file)
    }

    await prisma.onboardingDocument.upsert({
      where: { slug: entry.slug },
      create: {
        title: entry.title,
        slug: entry.slug,
        type: entry.type,
        category: entry.category,
        flowType: entry.flowType,
        tier: entry.tier,
        stepNumber: entry.stepNumber,
        unlockGroup: entry.unlockGroup,
        displayOrder: entry.stepNumber,
        sortOrder: entry.stepNumber,
        folder: entry.folder,
        isRequired: entry.isRequired,
        isActive: true,
        pdfData,
      },
      update: {
        title: entry.title,
        type: entry.type,
        category: entry.category,
        flowType: entry.flowType,
        tier: entry.tier,
        stepNumber: entry.stepNumber,
        unlockGroup: entry.unlockGroup,
        displayOrder: entry.stepNumber,
        sortOrder: entry.stepNumber,
        folder: entry.folder,
        isRequired: entry.isRequired,
        isActive: true,
        ...(pdfData ? { pdfData } : {}),
      },
    })
    upserted++
  }

  return { upserted, missingFiles }
}

/** Provision onboarding for a newly hired RBT (no legacy HIPAA tasks). */
export async function provisionOnboardingForHiredRbt(rbtProfileId: string): Promise<void> {
  await seedOnboardingCatalog()
  await ensureOnboardingCompletionsForRbt(rbtProfileId)
  await ensureHrDocumentTasksForRbt(rbtProfileId)
  await prisma.onboardingTask.deleteMany({ where: { rbtProfileId } })
}
