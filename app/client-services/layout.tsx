import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAdmin, validateSession } from '@/lib/auth'
import {
  canAccessClientServices,
  getElevatedClientServicesUser,
} from '@/lib/client-services/access'
import {
  canAccessCrmSchedule,
  canAccessDepartment,
  fetchUserCrmRoles,
  isFullAccess,
  isSuperAdmin,
} from '@/lib/crm/access'
import { bootstrapCrmSuperAdmins } from '@/lib/crm/bootstrapRoles'
import {
  DEPT_SLUGS,
  DEPT_SLUG_TO_OWNER,
  deptHref,
  deptLabel,
} from '@/lib/crm/departments'
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

  let showAdmin = false
  let showTherapistSearch = false
  let showScheduleNav = false
  let departmentNav: { href: string; label: string }[] = []
  // Skip department nav for clinical-surface-only portal users.
  if (elevated && elevatedUser) {
    try {
      await bootstrapCrmSuperAdmins()
    } catch (error) {
      console.error('[client-services] CRM role bootstrap failed', error)
    }
    const crmRoles = await fetchUserCrmRoles(elevatedUser.id)
    const subject = {
      id: elevatedUser.id,
      email: elevatedUser.email,
      crmRoles,
    }
    const { isClinicalSurfaceOnly } = await import('@/lib/crm/bcbaPortal')
    const clinicalOnly = isClinicalSurfaceOnly(subject)
    showAdmin = isSuperAdmin(subject) && !clinicalOnly
    showTherapistSearch =
      !clinicalOnly && canAccessDepartment(subject, 'STAFFING')
    showScheduleNav = !clinicalOnly && canAccessCrmSchedule(subject)
    const full = isFullAccess(subject)
    departmentNav = clinicalOnly
      ? []
      : DEPT_SLUGS.filter((slug) => {
          if (slug === 'authorization') return false
          return full ? true : canAccessDepartment(subject, DEPT_SLUG_TO_OWNER[slug])
        }).map((slug) => ({
          href: deptHref(slug),
          label: deptLabel(slug),
        }))
  }

  return (
    <ClientServicesLayout
      userName={user.name ?? user.email ?? 'User'}
      elevated={elevated}
      showAdmin={showAdmin}
      showTherapistSearch={showTherapistSearch}
      showScheduleNav={showScheduleNav}
      canAccessHrm={isAdmin(user)}
      departmentNav={departmentNav}
    >
      {elevated ? children : <ElevateGate userEmail={user.email ?? ''} />}
    </ClientServicesLayout>
  )
}
