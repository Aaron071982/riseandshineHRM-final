import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PayrollAdminPage from '@/components/admin/PayrollAdminPage'
import { validateSession, isBillingManager } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminPayrollPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !isBillingManager(user)) {
    redirect('/admin/dashboard')
  }

  return <PayrollAdminPage />
}
