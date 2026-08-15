import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { isClientServicesFullAccessEmail } from '@/lib/client-services/constants'
import CaseloadPageClient from '@/components/crm/CaseloadPageClient'

export const dynamic = 'force-dynamic'

export default async function ClientServicesCaseloadPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const user = token ? await validateSession(token) : null
  const canImport = isClientServicesFullAccessEmail(user?.email)

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-quiet">
          Loading caseload…
        </div>
      }
    >
      <CaseloadPageClient canImport={canImport} />
    </Suspense>
  )
}
