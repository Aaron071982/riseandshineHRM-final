import { redirect } from 'next/navigation'
import { getClientServicesPageUser } from '@/lib/crm/access'
import { loadManagerDashboard } from '@/lib/crm/dashboard'
import { canAccessOperations } from '@/lib/operations/access'
import ManagerDashboardWithOps from '@/components/crm/ManagerDashboardWithOps'
import { isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'
import { PORTAL_HOME_PATH } from '@/lib/crm/portalRouting'

export const dynamic = 'force-dynamic'

export default async function ClientServicesHomePage() {
  const user = await getClientServicesPageUser()
  if (!user) return null

  // Portal-only clinicians use the dedicated /portal shell.
  if (isClinicalSurfaceOnly(user)) {
    redirect(PORTAL_HOME_PATH)
  }

  const data = await loadManagerDashboard(user)
  return (
    <ManagerDashboardWithOps data={data} showOps={canAccessOperations(user)} />
  )
}
