import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import {
  canAccessClientServices,
  getElevatedClientServicesUser,
} from '@/lib/client-services/access'
import ClientServicesLayout from '@/components/client-services/ClientServicesLayout'
import ElevateGate from '@/components/client-services/ElevateGate'

export const dynamic = 'force-dynamic'

export default async function ClientServicesSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !(await canAccessClientServices(user))) {
    redirect('/admin/dashboard')
  }

  const elevatedUser = await getElevatedClientServicesUser()
  const elevated = !!elevatedUser

  return (
    <ClientServicesLayout
      userName={user.name ?? user.email ?? 'User'}
      elevated={elevated}
    >
      {elevated ? children : <ElevateGate userEmail={user.email ?? ''} />}
    </ClientServicesLayout>
  )
}
