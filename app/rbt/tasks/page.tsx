import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OnboardingWizard from '@/components/rbt/OnboardingWizard'
import { ensureOnboardingCompletionsForRbt } from '@/lib/onboarding/progress'
import { seedOnboardingCatalog } from '@/lib/onboarding/provision'

export const dynamic = 'force-dynamic'

export default async function RBTTasksPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) redirect('/')

  const user = await validateSession(sessionToken)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  try {
    await seedOnboardingCatalog()
    await ensureOnboardingCompletionsForRbt(user.rbtProfileId)
    const { ensureHrDocumentTasksForRbt } = await import('@/lib/onboarding/hr-tasks')
    await ensureHrDocumentTasksForRbt(user.rbtProfileId)
  } catch (e) {
    console.error('[rbt/tasks] onboarding provision failed', e)
  }

  const [onboardingDocuments, hrDocumentTasks] = await Promise.all([
    prisma.onboardingDocument.findMany({
      where: {
        isActive: true,
        stepNumber: { not: null, lte: 30 },
        flowType: { not: 'ADMIN_ONLY' },
      },
      orderBy: { stepNumber: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        category: true,
        flowType: true,
        tier: true,
        stepNumber: true,
        pdfUrl: true,
      },
    }),
    prisma.hRDocumentTask.findMany({
      where: { rbtProfileId: user.rbtProfileId },
    }),
  ])

  return (
    <OnboardingWizard
      rbtProfileId={user.rbtProfileId}
      initialDocuments={onboardingDocuments.map((d) => ({
        ...d,
        stepNumber: d.stepNumber!,
      }))}
      hrDocumentTasks={hrDocumentTasks}
    />
  )
}
