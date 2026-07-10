import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { isOperationsViewer } from '@/lib/auth/operationsAccess'
import { redirect } from 'next/navigation'
import OperationsLayout from '@/components/operations/OperationsLayout'

export const dynamic = 'force-dynamic'

export default async function OperationsSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !isOperationsViewer(user)) {
    redirect('/login?session_expired=1')
  }

  return (
    <OperationsLayout userName={user.name ?? user.email ?? 'Operations'}>
      {children}
    </OperationsLayout>
  )
}
