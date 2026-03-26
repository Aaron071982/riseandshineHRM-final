import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import RBTSessionsPage from '@/components/rbt/RBTSessionsPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SessionsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) redirect('/')

  const user = await validateSession(sessionToken)
  if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
    redirect('/')
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    select: { id: true, status: true },
  })
  if (!profile || profile.status !== 'HIRED') {
    redirect('/rbt/dashboard')
  }

  const [tasks, completedDocs, totalDocs] = await Promise.all([
    prisma.onboardingTask.findMany({
      where: { rbtProfileId: profile.id },
      select: { isCompleted: true },
    }),
    prisma.onboardingCompletion.count({
      where: { rbtProfileId: profile.id, status: 'COMPLETED' },
    }),
    prisma.onboardingDocument.count({ where: { isActive: true } }),
  ])
  const completedTasks = tasks.filter((t) => t.isCompleted).length
  const totalSteps = tasks.length + totalDocs
  const completedSteps = completedTasks + completedDocs
  if (!(totalSteps > 0 && completedSteps >= totalSteps)) {
    redirect('/rbt/dashboard')
  }

  return <RBTSessionsPage />
}
