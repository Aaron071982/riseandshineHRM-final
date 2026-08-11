import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { isClientServicesFullAccessEmail } from '@/lib/client-services/constants'
import ClientServicesDashboard from '@/components/client-services/ClientServicesDashboard'

export const dynamic = 'force-dynamic'

export default async function ClientServicesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const user = token ? await validateSession(token) : null
  const canImport = isClientServicesFullAccessEmail(user?.email)

  return <ClientServicesDashboard canImport={canImport} />
}
