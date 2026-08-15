import { getClientServicesUser } from '@/lib/crm/access'
import { loadManagerDashboard } from '@/lib/crm/dashboard'
import ManagerDashboard from '@/components/crm/ManagerDashboard'

export const dynamic = 'force-dynamic'

export default async function ClientServicesHomePage() {
  const user = await getClientServicesUser()
  const data = await loadManagerDashboard(user)
  return <ManagerDashboard data={data} />
}
