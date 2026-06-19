import { cookies } from 'next/headers'
import { validateSession, isBillingManager } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BillingLayout from '@/components/billing/BillingLayout'

export const dynamic = 'force-dynamic'

export default async function BillingSectionLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !isBillingManager(user)) {
    redirect('/login?session_expired=1')
  }

  return (
    <BillingLayout userName={user.name ?? user.email ?? 'Billing'} isAdmin={user.role === 'ADMIN'}>
      {children}
    </BillingLayout>
  )
}
