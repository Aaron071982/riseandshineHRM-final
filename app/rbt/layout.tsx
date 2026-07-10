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

    const profile = await prisma.rBTProfile.findUnique({
      where: { id: user.rbtProfileId },
      select: { id: true, firstName: true, status: true, tierACompletedAt: true },
    })

    if (!profile || profile.status === 'FIRED') {
      redirect('/')
    }

    let rbtFirstName: string | null = profile.firstName ?? null
    let canAccessSessions = false
    let hasActiveSession = false
    try {
      if (profile.status === 'HIRED') {
        canAccessSessions = !!profile.tierACompletedAt
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

