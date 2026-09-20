import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import { canAccessClientServices } from '@/lib/client-services/access'
import { fetchUserCrmRoles } from '@/lib/crm/access'
import {
  hasBcbaPortalAccess,
  isClinicalSurfaceOnly,
} from '@/lib/crm/bcbaPortal'
import { listPortalInbox } from '@/lib/crm/portalNotifications'
import { PortalInboxPageClient } from '@/components/portal/PortalInboxPageClient'
import type { PortalNotificationType } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function PortalInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; clientId?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !(await canAccessClientServices(user))) redirect('/login')

  const crmRoles = await fetchUserCrmRoles(user.id)
  const subject = { id: user.id, email: user.email, crmRoles, name: user.name }
  if (!hasBcbaPortalAccess(subject) || !isClinicalSurfaceOnly(subject)) {
    redirect('/client-services')
  }

  const sp = await searchParams
  const type = sp.type as PortalNotificationType | undefined
  const allowed: PortalNotificationType[] = [
    'CLIENT_ASSIGNED',
    'THERAPIST_ASSIGNED',
    'IN_COORDINATION',
    'READY_FOR_ASSESSMENT',
  ]
  const filterType = type && allowed.includes(type) ? type : undefined

  const inbox = await listPortalInbox(subject, {
    limit: 100,
    type: filterType,
    clientId: sp.clientId || undefined,
  })

  return (
    <PortalInboxPageClient
      items={inbox.items}
      unreadCount={inbox.unreadCount}
      activeType={filterType ?? null}
    />
  )
}
