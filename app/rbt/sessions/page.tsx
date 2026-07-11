import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import RbtSessionsPayPage from '@/components/rbt/RbtSessionsPayPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SessionsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) redirect('/')

  const user = await validateSession(sessionToken)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    select: { id: true, status: true },
  })
  if (!profile || (profile.status !== 'HIRED' && profile.status !== 'ONBOARDING_COMPLETED')) {
    redirect('/rbt/dashboard')
  }

  return <RbtSessionsPayPage />
}
