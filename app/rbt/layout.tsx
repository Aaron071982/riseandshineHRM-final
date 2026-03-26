import RBTLayout from '@/components/layout/RBTLayout'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function RBTLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      redirect('/')
    }

    const user = await validateSession(sessionToken)
    // Allow both CANDIDATE and RBT roles to access the portal
    if (!user || !user.rbtProfileId || (user.role !== 'RBT' && user.role !== 'CANDIDATE')) {
      redirect('/')
    }

    let rbtFirstName: string | null = null
    let canAccessSessions = false
    let hasActiveSession = false
    try {
      const profile = await prisma.rBTProfile.findUnique({
        where: { id: user.rbtProfileId },
        select: { id: true, firstName: true, status: true },
      })
      rbtFirstName = profile?.firstName ?? null

      if (profile?.status === 'HIRED') {
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
        canAccessSessions = totalSteps > 0 && completedSteps >= totalSteps
      }

      if (canAccessSessions) {
        const active = await prisma.timeEntry.findFirst({
          where: { rbtProfileId: user.rbtProfileId, clockOutTime: null },
          select: { id: true },
        })
        hasActiveSession = !!active
      }
    } catch {
      // non-fatal
    }

    return (
      <RBTLayout rbtFirstName={rbtFirstName} canAccessSessions={canAccessSessions} hasActiveSession={hasActiveSession}>
        {children}
      </RBTLayout>
    )
  } catch (e) {
    console.error('RBT layout: session validation failed', e)
    redirect('/')
  }
}

