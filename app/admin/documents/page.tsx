import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminCompanyDocumentsPage from '@/components/admin/AdminCompanyDocumentsPage'
import { validateSession, isAdmin } from '@/lib/auth'
import { canAccessDocumentsEmail } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function AdminDocumentsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !isAdmin(user) || !canAccessDocumentsEmail(user.email)) {
    redirect('/admin/dashboard')
  }

  return <AdminCompanyDocumentsPage />
}
