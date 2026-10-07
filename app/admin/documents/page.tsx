import { cookies } from 'next/headers'
import Link from 'next/link'
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/admin/compliance/i9" className="text-sm font-medium text-orange-600 hover:underline">
          Form I-9 compliance report →
        </Link>
      </div>
      <AdminCompanyDocumentsPage />
    </div>
  )
}
