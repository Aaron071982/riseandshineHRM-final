import { Suspense } from 'react'
import {
  auditClientAction,
  canAccessDepartment,
  CrmAccessError,
  getClientServicesPageUser,
} from '@/lib/crm/access'
import { loadTherapistSearchClient } from '@/lib/crm/therapistSearchData'
import TherapistSearchClient from '@/components/crm/TherapistSearchClient'
import TherapistSearchShell from '@/components/crm/TherapistSearchShell'
import TherapistClientMapClient from '@/components/crm/TherapistClientMapClient'

export const dynamic = 'force-dynamic'

export default async function TherapistSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; view?: string }>
}) {
  const user = await getClientServicesPageUser()
  if (!user) return null
  if (!canAccessDepartment(user, 'STAFFING')) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--urgent)] bg-[var(--urgent-bg)] px-5 py-8 text-center">
        <h1 className="font-display text-lg font-semibold text-[var(--urgent)]">
          403 — Staffing access required
        </h1>
        <p className="mt-2 text-sm text-ink">
          Therapist Search is available only to CRM Staffing members and
          full-access users.
        </p>
      </div>
    )
  }

  const { clientId, view } = await searchParams

  if (view === 'map') {
    await auditClientAction({
      userId: user.id,
      action: 'THERAPIST_CLIENT_MAP_VIEW',
    })
  } else {
    await auditClientAction({
      userId: user.id,
      action: 'THERAPIST_SEARCH_PAGE_VIEW',
    })
  }

  let client = null
  if (clientId) {
    try {
      client = await loadTherapistSearchClient(user, clientId)
    } catch (error) {
      if (!(error instanceof CrmAccessError)) throw error
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-[var(--urgent)] bg-[var(--urgent-bg)] px-5 py-8 text-center">
          <h1 className="font-display text-lg font-semibold text-[var(--urgent)]">
            403 — Client access denied
          </h1>
          <p className="mt-2 text-sm text-ink">
            You cannot run Therapist Search for this client.
          </p>
        </div>
      )
    }
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-quiet">
          Loading…
        </div>
      }
    >
      <TherapistSearchShell
        searchContent={<TherapistSearchClient client={client} embedded />}
        mapContent={<TherapistClientMapClient />}
      />
    </Suspense>
  )
}
