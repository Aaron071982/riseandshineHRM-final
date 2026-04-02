import type { PrismaClient } from '@prisma/client'

const SSN_TITLE = 'Upload Social Security card'
const SSN_DESCRIPTION =
  'Upload a clear photo or scan of your Social Security card (PDF, JPG, or PNG, max 10MB). This is required for payroll and employment records.'

/**
 * Inserts the Social Security upload task before the signature step when missing.
 * Bumps the signature task sortOrder. Idempotent.
 */
export async function ensureSocialSecurityOnboardingTask(
  prisma: PrismaClient,
  rbtProfileId: string
): Promise<{ added: boolean }> {
  const tasks = await prisma.onboardingTask.findMany({
    where: { rbtProfileId },
    select: { id: true, taskType: true, sortOrder: true },
  })
  if (tasks.some((t) => t.taskType === 'SOCIAL_SECURITY_DOCUMENT')) {
    return { added: false }
  }
  const sig = tasks.find((t) => t.taskType === 'SIGNATURE')
  if (!sig) return { added: false }

  const hasForty = tasks.some((t) => t.taskType === 'FORTY_HOUR_COURSE_CERTIFICATE')
  const ssnSort = hasForty ? 7 : 6
  const newSigSort = hasForty ? 8 : 7

  await prisma.$transaction([
    prisma.onboardingTask.update({
      where: { id: sig.id },
      data: { sortOrder: newSigSort },
    }),
    prisma.onboardingTask.create({
      data: {
        rbtProfileId,
        taskType: 'SOCIAL_SECURITY_DOCUMENT',
        title: SSN_TITLE,
        description: SSN_DESCRIPTION,
        documentDownloadUrl: null,
        sortOrder: ssnSort,
      },
    }),
  ])
  return { added: true }
}

export function socialSecurityTaskSeed(hasFortyHourCourse: boolean) {
  return {
    taskType: 'SOCIAL_SECURITY_DOCUMENT' as const,
    title: SSN_TITLE,
    description: SSN_DESCRIPTION,
    documentDownloadUrl: null as string | null,
    sortOrder: hasFortyHourCourse ? 7 : 6,
  }
}

export function signatureTaskSortOrder(hasFortyHourCourse: boolean) {
  return hasFortyHourCourse ? 8 : 7
}
