import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import RBTProfileView from '@/components/admin/RBTProfileView'

export default async function RBTProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const rbtProfile = await prisma.rBTProfile.findUnique({
    where: { id },
    include: {
      user: true,
      interviews: {
        orderBy: {
          scheduledAt: 'desc',
        },
        include: {
          interviewNotes: true,
        },
      },
      onboardingTasks: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
      documents: {
        orderBy: {
          uploadedAt: 'desc',
        },
      },
      onboardingCompletions: {
        select: {
          id: true,
          documentId: true,
          status: true,
          completedAt: true,
          acknowledgmentJson: true,
          document: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  if (!rbtProfile) {
    notFound()
  }

  return <RBTProfileView rbtProfile={rbtProfile} />
}

