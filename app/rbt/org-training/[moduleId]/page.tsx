import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchUserCrmRoles } from '@/lib/crm/access'
import {
  moduleAssignedToUser,
  userAudienceKeys,
} from '@/lib/org-training/audience'
import {
  getCompletionStatus,
  loadModuleDetail,
} from '@/lib/org-training/load'
import OrgTrainingTakeModule from '@/components/org-training/OrgTrainingTakeModule'

export const dynamic = 'force-dynamic'

export default async function RbtOrgTrainingModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/')

  const user = await validateSession(token)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    select: { status: true },
  })
  if (
    !profile ||
    (profile.status !== 'HIRED' && profile.status !== 'ONBOARDING_COMPLETED')
  ) {
    redirect('/rbt/dashboard')
  }

  const { moduleId } = await params
  const trainingModule = await loadModuleDetail(moduleId)
  if (!trainingModule || trainingModule.status !== 'ACTIVE') notFound()

  const crmRoles = await fetchUserCrmRoles(user.id)
  const keys = userAudienceKeys({ role: user.role, crmRoles })
  if (!moduleAssignedToUser(trainingModule, keys)) {
    redirect('/rbt/org-training')
  }

  const completion = await getCompletionStatus(moduleId, user.id)

  return (
    <OrgTrainingTakeModule
      module={trainingModule}
      completed={!!completion?.completed}
      completedAt={completion?.completedAt?.toISOString() ?? null}
      basePath="/rbt/org-training"
    />
  )
}
