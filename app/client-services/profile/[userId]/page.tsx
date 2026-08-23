import { notFound } from 'next/navigation'
import { CrmAccessError, getClientServicesUser } from '@/lib/crm/access'
import { loadStaffProfile } from '@/lib/crm/profile/loadStaffProfile'
import { StaffProfileClient } from '@/components/crm/profile/StaffProfileClient'

export const dynamic = 'force-dynamic'

export default async function StaffProfileByUserPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  try {
    await getClientServicesUser()
    const data = await loadStaffProfile(userId)
    return <StaffProfileClient data={data} />
  } catch (err) {
    if (err instanceof CrmAccessError && err.status === 404) notFound()
    if (err instanceof CrmAccessError && err.status === 403) notFound()
    throw err
  }
}
