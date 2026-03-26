import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import RBTProfileView from '@/components/rbt/RBTProfileView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RBTProfilePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  const user = await validateSession(sessionToken)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    include: {
      availabilitySlots: true,
      user: { include: { profile: { select: { startDate: true, rbtCertificationNumber: true, rbtCertificationExpiresAt: true } } } },
    },
  })

  if (!profile) {
    redirect('/')
  }

  return <RBTProfileView profile={profile} />
}
