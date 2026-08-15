import { Suspense } from 'react'
import ClientCrmDetail from '@/components/crm/ClientCrmDetail'
import { CrmAccessError } from '@/lib/crm/access'
import { loadClientCrmDetail } from '@/lib/crm/loadClientDetail'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ClientServicesClientPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params
  const { tab } = await searchParams

  try {
    const data = await loadClientCrmDetail(id)
    const serialized = JSON.parse(JSON.stringify(data)) as typeof data
    return (
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-quiet">
            Loading client…
          </div>
        }
      >
        <ClientCrmDetail
          initialTab={tab}
          data={{
            user: {
              id: serialized.user.id,
              email: serialized.user.email ?? null,
              fullAccess: serialized.user.fullAccess,
            },
            daysInStage: serialized.daysInStage,
            weeklyScheduleHours: serialized.weeklyScheduleHours,
            canOverrideStage: serialized.canOverrideStage,
            gate: serialized.gate,
            client: serialized.client,
          }}
        />
      </Suspense>
    )
  } catch (err) {
    if (err instanceof CrmAccessError && err.status === 403) {
      return (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="font-display text-xl font-semibold text-ink">Access denied</h1>
          <p className="mt-2 text-sm text-quiet">
            You don’t have permission to view this client.
          </p>
        </div>
      )
    }
    throw err
  }
}
