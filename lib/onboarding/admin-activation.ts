import { prisma } from '@/lib/prisma'

/** Mark admin-only catalog step completion row when admin activates task 31/32. */
export async function markAdminStepCompletion(
  rbtProfileId: string,
  slug: 'background-check-cleared' | 'supervision-countersigned'
): Promise<void> {
  const doc = await prisma.onboardingDocument.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  })
  if (!doc) return

  const now = new Date()
  await prisma.onboardingCompletion.upsert({
    where: {
      rbtProfileId_documentId: { rbtProfileId, documentId: doc.id },
    },
    create: {
      rbtProfileId,
      documentId: doc.id,
      status: 'COMPLETED',
      completedAt: now,
    },
    update: {
      status: 'COMPLETED',
      completedAt: now,
    },
  })
}
