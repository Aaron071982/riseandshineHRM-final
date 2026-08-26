import { redirect } from 'next/navigation'
import { getClientServicesPageUser } from '@/lib/crm/access'
import { canAccessOperations } from '@/lib/operations/access'
import { QueryBuilderClient } from '@/components/crm/operations/QueryBuilderClient'

export const dynamic = 'force-dynamic'

export default async function OperationsQueryPage() {
  const user = await getClientServicesPageUser()
  if (!user) redirect('/client-services')
  if (!canAccessOperations(user)) redirect('/client-services')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <QueryBuilderClient />
    </div>
  )
}
