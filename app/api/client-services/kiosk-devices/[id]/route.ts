import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { isFullAccess } from '@/lib/crm/access'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { logClientAccess } from '@/lib/client-services/audit'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

/** Revoke or reactivate a kiosk device. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  if (!isFullAccess(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json(
      { error: 'isActive (boolean) is required' },
      { status: 400 }
    )
  }

  const existing = await prisma.kioskDevice.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  const device = await prisma.kioskDevice.update({
    where: { id },
    data: { isActive: body.isActive },
    select: {
      id: true,
      label: true,
      locationLabel: true,
      tokenLast4: true,
      isActive: true,
      createdAt: true,
    },
  })

  await logClientAccess({
    userId: user.id,
    action: body.isActive ? 'KIOSK_DEVICE_REACTIVATE' : 'KIOSK_DEVICE_REVOKE',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({ device })
}
