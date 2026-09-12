import { getClientServicesPageUser } from '@/lib/crm/access'
import { loadManagerDashboard } from '@/lib/crm/dashboard'
import { canAccessOperations } from '@/lib/operations/access'
import ManagerDashboardWithOps from '@/components/crm/ManagerDashboardWithOps'
import { BcbaPortalDashboardClient } from '@/components/crm/BcbaPortalDashboardClient'
import { isClinicalLead, isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'
import { loadBcbaPortalDashboard } from '@/lib/crm/bcbaPortalDashboard'

export const dynamic = 'force-dynamic'

export default async function ClientServicesHomePage() {
  const user = await getClientServicesPageUser()
  if (!user) return null

  if (isClinicalSurfaceOnly(user)) {
    const data = await loadBcbaPortalDashboard(user)
    return (
      <BcbaPortalDashboardClient data={data} isLead={isClinicalLead(user)} />
    )
  }

  const data = await loadManagerDashboard(user)
  return (
    <ManagerDashboardWithOps data={data} showOps={canAccessOperations(user)} />
  )
}
