import { getClientServicesUser } from '@/lib/crm/access'
import { listAssignedModulesForUser } from '@/lib/org-training/load'
import OrgTrainingModuleList from '@/components/org-training/OrgTrainingModuleList'

export const dynamic = 'force-dynamic'

export default async function ClientServicesTrainingPage() {
  const user = await getClientServicesUser()
  const modules = await listAssignedModulesForUser({
    id: user.id,
    role: user.role,
    crmRoles: user.crmRoles,
  })

  return (
    <OrgTrainingModuleList
      modules={modules}
      basePath="/client-services/training"
      title="Training"
      subtitle="Modules assigned to your CRM and user roles."
    />
  )
}
