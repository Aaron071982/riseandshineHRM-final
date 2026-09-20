import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { fetchUserCrmRoles } from '@/lib/crm/access'
import { hasBcbaPortalAccess } from '@/lib/crm/bcbaPortal'
import { markPortalNotificationsRead } from '@/lib/crm/portalNotifications'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await validateSession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const crmRoles = await fetchUserCrmRoles(user.id)
  if (!hasBcbaPortalAccess({ id: user.id, email: user.email, crmRoles })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    all?: boolean
    ids?: string[]
  }

  const count = await markPortalNotificationsRead(user.id, {
    all: body.all === true,
    ids: Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string') : undefined,
  })

  return NextResponse.json({ ok: true, count })
}
