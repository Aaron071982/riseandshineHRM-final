import { getClientServicesUser } from '@/lib/crm/access'
import { getCurrentUser } from '@/lib/auth'
import {
  canAuthorOrgTraining,
  canViewOrgTrainingMatrix,
} from '@/lib/org-training/access'
import { createOrgTrainingModule } from '@/lib/org-training/actions'
import {
  listAllModulesForAdmin,
  listAssignedModulesForUser,
} from '@/lib/org-training/load'
import { buildAudienceTrainingSummaries } from '@/lib/org-training/rbtSummary'
import OrgTrainingManageHub from '@/components/org-training/OrgTrainingManageHub'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function createModuleAction() {
  'use server'
  const result = await createOrgTrainingModule({
    title: 'New training module',
    audienceRoles: ['RBT'],
    required: true,
  })
  if (!result.ok) {
    redirect('/client-services/training?error=' + encodeURIComponent(result.error))
  }
  redirect(`/client-services/training/manage/${result.data.id}`)
}

export default async function ClientServicesTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const crmUser = await getClientServicesUser()
  const sessionUser = await getCurrentUser()
  const params = await searchParams

  const canManage = canAuthorOrgTraining(sessionUser, crmUser)
  const canMatrix = canViewOrgTrainingMatrix(sessionUser, crmUser)

  const [myModules, modules, summaries] = await Promise.all([
    listAssignedModulesForUser({
      id: crmUser.id,
      role: crmUser.role,
      crmRoles: crmUser.crmRoles,
    }),
    canManage ? listAllModulesForAdmin() : Promise.resolve([]),
    canManage ? buildAudienceTrainingSummaries() : Promise.resolve([]),
  ])

  return (
    <OrgTrainingManageHub
      canManage={canManage}
      canViewMatrix={canMatrix}
      modules={modules}
      myModules={myModules}
      summaries={summaries}
      createModuleAction={canManage ? createModuleAction : undefined}
      error={params.error ?? null}
    />
  )
}
