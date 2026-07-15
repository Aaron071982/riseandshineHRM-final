import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession, isBillingManager } from '@/lib/auth'
import PayrollYtdImportWizard from '@/components/admin/PayrollYtdImportWizard'

export const dynamic = 'force-dynamic'

export default async function AdminPayrollYtdImportPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !isBillingManager(user)) {
    redirect('/admin/dashboard')
  }

  return <PayrollYtdImportWizard backHref="/admin/payroll" />
}
