import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import {
  canAccessClientServices,
  getElevatedClientServicesUser,
} from '@/lib/client-services/access'
import { fetchUserCrmRoles } from '@/lib/crm/access'
import {
  hasBcbaPortalAccess,
  isClinicalSurfaceOnly,
} from '@/lib/crm/bcbaPortal'
import ElevateGate from '@/components/client-services/ElevateGate'
import { PortalShell } from '@/components/portal/PortalShell'
import { listPortalInbox } from '@/lib/crm/portalNotifications'

export const dynamic = 'force-dynamic'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !(await canAccessClientServices(user))) {
    redirect('/login')
  }

  const crmRoles = await fetchUserCrmRoles(user.id)
  const subject = { id: user.id, email: user.email, crmRoles, name: user.name }

  if (!hasBcbaPortalAccess(subject)) {
    redirect('/client-services')
  }

  // Full CRM staff keep the admin Client Services app — portal is for
  // external BCBA / clinical-lead surfaces only.
  if (!isClinicalSurfaceOnly(subject)) {
    redirect('/client-services')
  }

  const elevatedUser = await getElevatedClientServicesUser()
  const elevated = !!elevatedUser
  const userName = user.name ?? user.email ?? 'Clinician'
  const isLead = crmRoles.includes('CLINICAL_LEAD')
  const credentialsLine = user.name?.trim()
    ? `${user.name.trim()}${isLead ? ', Clinical Lead' : ', BCBA'}`
    : user.email

  let inboxUnread = 0
  if (elevated) {
    try {
      const inbox = await listPortalInbox(subject, { limit: 1 })
      inboxUnread = inbox.unreadCount
    } catch {
      inboxUnread = 0
    }
  }

  if (!elevated) {
    return (
      <PortalShell
        userName={userName}
        credentialsLine={credentialsLine}
        inboxUnread={0}
      >
        <div className="mx-auto max-w-lg px-4 py-16">
          <ElevateGate userEmail={user.email ?? ''} />
        </div>
      </PortalShell>
    )
  }

  return (
    <PortalShell
      userName={userName}
      credentialsLine={credentialsLine}
      inboxUnread={inboxUnread}
    >
      {children}
    </PortalShell>
  )
}
