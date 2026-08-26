import { notFound, redirect } from 'next/navigation'
import { getClientServicesUser } from '@/lib/crm/access'
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

export default async function ClientServicesTrainingModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const user = await getClientServicesUser()
  const { moduleId } = await params
  const trainingModule = await loadModuleDetail(moduleId)
  if (!trainingModule || trainingModule.status !== 'ACTIVE') notFound()

  const keys = userAudienceKeys({
    role: user.role,
    crmRoles: user.crmRoles,
  })
  if (!moduleAssignedToUser(trainingModule, keys)) {
    redirect('/client-services/training')
  }

  const completion = await getCompletionStatus(moduleId, user.id)

  return (
    <OrgTrainingTakeModule
      module={trainingModule}
      completed={!!completion?.completed}
      completedAt={completion?.completedAt?.toISOString() ?? null}
      basePath="/client-services/training"
    />
  )
}
