import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import OnboardingWizard from '@/components/rbt/OnboardingWizard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RBTTasksPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  const user = await validateSession(sessionToken)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  const [onboardingTasks, onboardingDocuments, completions, userProfile] = await Promise.all([
    prisma.onboardingTask.findMany({
      where: { rbtProfileId: user.rbtProfileId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.onboardingDocument.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.onboardingCompletion.findMany({
      where: { rbtProfileId: user.rbtProfileId },
      include: { document: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { eSignConsentGiven: true },
    }),
  ])

  const eSignConsentGiven = userProfile?.eSignConsentGiven === true

  return (
    <OnboardingWizard
      rbtProfileId={user.rbtProfileId}
      onboardingTasks={onboardingTasks}
      onboardingDocuments={onboardingDocuments}
      completions={completions}
      eSignConsentGiven={eSignConsentGiven}
    />
  )
}
