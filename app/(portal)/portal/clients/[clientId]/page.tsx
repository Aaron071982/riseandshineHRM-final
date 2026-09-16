import { CrmAccessError, getClientServicesPageUser } from '@/lib/crm/access'
import { isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'
import { loadClientCrmDetail } from '@/lib/crm/loadClientDetail'
import { PortalClientDetail } from '@/components/portal/PortalClientDetail'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function PortalClientPage({ params, searchParams }: Props) {
  const user = await getClientServicesPageUser()
  if (!user) return null
  if (!isClinicalSurfaceOnly(user)) redirect('/client-services')

  const { clientId } = await params
  const { tab } = await searchParams

  try {
    // loadClientCrmDetail → assertCanViewClient + getVisibleClientsWhere
    const data = await loadClientCrmDetail(clientId)
    const serialized = JSON.parse(JSON.stringify(data)) as typeof data

    return (
      <PortalClientDetail
        initialTab={tab}
        data={{
          client: serialized.client,
          weeklyScheduleHours: serialized.weeklyScheduleHours,
          treatmentAssessment: serialized.treatmentAssessment,
        }}
      />
    )
  } catch (err) {
    if (err instanceof CrmAccessError && err.status === 403) {
      return (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="font-display text-xl font-semibold text-[var(--espresso)]">
            Access denied
          </h1>
          <p className="mt-2 text-sm text-quiet">
            You don&apos;t have permission to view this client. If you think this
            is a mistake, ask an admin to assign you as the BCBA on the case.
          </p>
        </div>
      )
    }
    if (err instanceof CrmAccessError && err.status === 401) return null
    throw err
  }
}
