import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import RbtCertJourneyClient from '@/components/rbt/RbtCertJourneyClient'

export const dynamic = 'force-dynamic'

export default async function RbtGetCertifiedPage() {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    select: {
      firstName: true,
      status: true,
      rbtExamScheduledAt: true,
      rbtExamOutcome: true,
      examFeeRequests: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          note: true,
          adminNote: true,
          createdAt: true,
          reviewedAt: true,
        },
      },
    },
  })

  if (
    !profile ||
    (profile.status !== 'HIRED' && profile.status !== 'ONBOARDING_COMPLETED')
  ) {
    redirect('/rbt/dashboard')
  }

  return (
    <RbtCertJourneyClient
      firstName={profile.firstName}
      scheduledAt={profile.rbtExamScheduledAt?.toISOString() ?? null}
      outcome={profile.rbtExamOutcome}
      feeRequests={profile.examFeeRequests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      }))}
    />
  )
}
