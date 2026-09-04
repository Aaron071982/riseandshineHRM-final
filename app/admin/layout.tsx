import AdminLayout from '@/components/layout/AdminLayout'
import { cookies } from 'next/headers'
import { validateSession, isAdmin, isBillingManager, isExecutiveAdmin } from '@/lib/auth'
import { isOperationsViewer } from '@/lib/auth/operationsAccess'
import { shouldRedirectAdminToCrm } from '@/lib/auth/postLogin'
import { canAccessDocumentsEmail } from '@/lib/constants'
import { canAccessClientServices } from '@/lib/client-services/access'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  let sessionToken: string | undefined
  try {
    const cookieStore = await cookies()
    sessionToken = cookieStore.get('session')?.value
  } catch (e) {
    console.error('Admin layout: failed to read cookies', e)
    redirect('/login?session_error=1')
  }
  if (!sessionToken) {
    redirect('/login')
  }

  let user: Awaited<ReturnType<typeof validateSession>>
  try {
    user = await validateSession(sessionToken)
  } catch (e) {
    console.error('Admin layout: session validation failed', e)
    redirect('/login?session_error=1')
  }
  if (!user || !isAdmin(user)) {
    redirect('/login?session_expired=1')
  }

  // CRM-only admins (everyone except irsal/tisha) have no HRM portal.
  if (shouldRedirectAdminToCrm(user.email, user.role)) {
    redirect('/client-services')
  }

  return (
    <AdminLayout
      showBillingNav={isBillingManager(user)}
      showOperationsNav={isOperationsViewer(user)}
      showDocumentsNav={canAccessDocumentsEmail(user.email)}
      showClientServicesNav={await canAccessClientServices(user)}
      showScheduleNav={false}
      isExecutive={isExecutiveAdmin(user)}
    >
      {children}
    </AdminLayout>
  )
}
