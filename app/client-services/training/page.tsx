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
  type OrgTrainingAssignedModule,
  type OrgTrainingModuleListItem,
} from '@/lib/org-training/load'
import {
  buildAudienceTrainingSummaries,
  type AudienceTrainingSummary,
} from '@/lib/org-training/rbtSummary'
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

  let myModules: OrgTrainingAssignedModule[] = []
  let modules: OrgTrainingModuleListItem[] = []
  let summaries: AudienceTrainingSummary[] = []
  let loadError: string | null = null

  try {
    myModules = await listAssignedModulesForUser({
      id: crmUser.id,
      role: crmUser.role,
      crmRoles: crmUser.crmRoles,
    })
  } catch (err) {
    console.error('[training] listAssignedModulesForUser failed', err)
    loadError = 'Could not load your assigned training. Tables may not be migrated yet.'
  }

  if (canManage) {
    try {
      ;[modules, summaries] = await Promise.all([
        listAllModulesForAdmin(),
        buildAudienceTrainingSummaries(),
      ])
    } catch (err) {
      console.error('[training] manage hub load failed', err)
      loadError =
        loadError ??
        'Could not load training modules. Run the org training SQL migration if this persists.'
    }
  }

  return (
    <OrgTrainingManageHub
      canManage={canManage}
      canViewMatrix={canMatrix}
      modules={modules}
      myModules={myModules}
      summaries={summaries}
      createModuleAction={canManage ? createModuleAction : undefined}
      error={params.error ?? loadError}
    />
  )
}
