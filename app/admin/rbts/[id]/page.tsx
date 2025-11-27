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
      },
      onboardingTasks: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  })

  if (!rbtProfile) {
    notFound()
  }

  return <RBTProfileView rbtProfile={rbtProfile} />
}

