import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { notFound } from 'next/navigation'
import RBTProfileView from '@/components/admin/RBTProfileView'

const rbtProfileInclude = {
  user: true,
  interviews: {
    orderBy: { scheduledAt: 'desc' as const },
    include: { interviewNotes: true },
  },
  onboardingTasks: { orderBy: { sortOrder: 'asc' as const } },
  documents: { orderBy: { uploadedAt: 'desc' as const } },
  onboardingCompletions: {
    select: {
      id: true,
      documentId: true,
      status: true,
      completedAt: true,
      acknowledgmentJson: true,
      document: { select: { id: true, title: true, type: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const

type RBTProfileWithRelations = Prisma.RBTProfileGetPayload<{ include: typeof rbtProfileInclude }>

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RBTProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let rbtProfile: RBTProfileWithRelations | null = null
  try {
    rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: rbtProfileInclude,
    })
  } catch (error) {
    console.error('Admin rbts [id]: failed to load profile', error)
    notFound()
  }

  if (!rbtProfile) {
    notFound()
  }

  return <RBTProfileView rbtProfile={rbtProfile} />
}

