import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { isClientServicesFullAccessEmail } from '@/lib/client-services/constants'
import ClientDetailPage from '@/components/client-services/ClientDetailPage'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function ClientServicesClientPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const user = token ? await validateSession(token) : null

  return (
    <ClientDetailPage
      clientId={id}
      canEditPhi={isClientServicesFullAccessEmail(user?.email)}
    />
  )
}
