import { getClientServicesPageUser } from '@/lib/crm/access'
import { isClinicalLead, isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'
import { loadBcbaPortalDashboard } from '@/lib/crm/bcbaPortalDashboard'
import { PortalHomeClient } from '@/components/portal/PortalHomeClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PortalHomePage() {
  const user = await getClientServicesPageUser()
  if (!user) return null

  if (!isClinicalSurfaceOnly(user)) {
    redirect('/client-services')
  }

  const data = await loadBcbaPortalDashboard(user)
  return <PortalHomeClient data={data} isLead={isClinicalLead(user)} />
}
