import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import OnboardingDashboard from '@/components/rbt/OnboardingDashboard'
import RBTMainDashboard from '@/components/rbt/RBTMainDashboard'

export default async function RBTDashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  const user = await validateSession(sessionToken)
  if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
    redirect('/')
  }

  // Check if onboarding is complete
  const onboardingTasks = await prisma.onboardingTask.findMany({
    where: {
      rbtProfileId: user.rbtProfileId,
    },
  })

  const allTasksCompleted = onboardingTasks.length > 0 && onboardingTasks.every((task) => task.isCompleted)

  if (!allTasksCompleted) {
    return <OnboardingDashboard rbtProfileId={user.rbtProfileId} />
  }

  return <RBTMainDashboard rbtProfileId={user.rbtProfileId} />
}

