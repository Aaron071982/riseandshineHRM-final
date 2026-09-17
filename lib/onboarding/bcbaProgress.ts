import { prisma } from '@/lib/prisma'

export async function ensureBcbaOnboardingCompletions(bcbaProfileId: string) {
  const docs = await prisma.bcbaOnboardingDocument.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { displayOrder: 'asc' },
  })
  if (docs.length === 0) return
  await prisma.bcbaOnboardingCompletion.createMany({
    data: docs.map((d) => ({
      bcbaProfileId,
      documentId: d.id,
      status: 'NOT_STARTED',
    })),
    skipDuplicates: true,
  })
}

export async function getBcbaOnboardingProgress(bcbaProfileId: string) {
  await ensureBcbaOnboardingCompletions(bcbaProfileId)

  const [docs, completions, profile] = await Promise.all([
    prisma.bcbaOnboardingDocument.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.bcbaOnboardingCompletion.findMany({
      where: { bcbaProfileId },
    }),
    prisma.bCBAProfile.findUnique({
      where: { id: bcbaProfileId },
      select: { id: true, onboardingCompletedAt: true, fullName: true },
    }),
  ])

  const byDoc = new Map(completions.map((c) => [c.documentId, c]))
  const steps = docs.map((doc, index) => {
    const completion = byDoc.get(doc.id) ?? null
    const isComplete = completion?.status === 'COMPLETED'
    const priorComplete = docs
      .slice(0, index)
      .every((d) => byDoc.get(d.id)?.status === 'COMPLETED')
    const isLocked = index > 0 && !priorComplete
    return {
      document: doc,
      completion,
      isComplete,
      isLocked,
      isAvailable: !isLocked,
    }
  })

  const required = steps.filter((s) => s.document.isRequired)
  const completedCount = required.filter((s) => s.isComplete).length
  const total = required.length
  const fullyComplete = total > 0 && completedCount === total

  if (fullyComplete && profile && !profile.onboardingCompletedAt) {
    await prisma.bCBAProfile.update({
      where: { id: bcbaProfileId },
      data: { onboardingCompletedAt: new Date() },
    })
  }

  return {
    steps,
    completedCount,
    totalSteps: total,
    fullyComplete,
    profile,
  }
}
