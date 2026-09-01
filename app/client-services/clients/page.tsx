import { Suspense } from 'react'
import { getClientServicesPageUser, canCreateServiceClient } from '@/lib/crm/access'
import CaseloadPageClient from '@/components/crm/CaseloadPageClient'

export const dynamic = 'force-dynamic'

export default async function ClientServicesCaseloadPage() {
  const user = await getClientServicesPageUser()
  const canCreate = user ? canCreateServiceClient(user) : false

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-quiet">
          Loading caseload…
        </div>
      }
    >
      <CaseloadPageClient canCreate={canCreate} />
    </Suspense>
  )
}
