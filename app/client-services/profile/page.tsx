import { redirect } from 'next/navigation'
import { getClientServicesUser } from '@/lib/crm/access'
import { loadStaffProfile } from '@/lib/crm/profile/loadStaffProfile'
import { StaffProfileClient } from '@/components/crm/profile/StaffProfileClient'

export const dynamic = 'force-dynamic'

export default async function StaffProfilePage() {
  const user = await getClientServicesUser()
  const data = await loadStaffProfile(user.id)
  return <StaffProfileClient data={data} />
}
