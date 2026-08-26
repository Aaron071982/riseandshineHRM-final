import { getClientServicesPageUser } from '@/lib/crm/access'
import { loadManagerDashboard } from '@/lib/crm/dashboard'
import { canAccessOperations } from '@/lib/operations/access'
import ManagerDashboardWithOps from '@/components/crm/ManagerDashboardWithOps'

export const dynamic = 'force-dynamic'

export default async function ClientServicesHomePage() {
  const user = await getClientServicesPageUser()
  if (!user) return null
  const data = await loadManagerDashboard(user)
  return (
    <ManagerDashboardWithOps data={data} showOps={canAccessOperations(user)} />
  )
}
