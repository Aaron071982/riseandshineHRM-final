import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanEditClient,
  CrmAccessError,
} from '@/lib/crm/access'
import { logClientAccess } from '@/lib/client-services/audit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; eventId: string }> }

/** Void an attendance event (append-only trigger allows only void fields). */
export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id, eventId } = await context.params

  try {
    await assertCanEditClient(user, id)
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: err.status })
    }
    throw err
  }

  let body: { voidReason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const voidReason = (body.voidReason ?? '').trim()
  if (!voidReason) {
    return NextResponse.json(
      { error: 'voidReason is required' },
      { status: 400 }
    )
  }

  const existing = await prisma.clientAttendanceEvent.findFirst({
    where: { id: eventId, serviceClientId: id },
    select: { id: true, voidedAt: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.voidedAt) {
    return NextResponse.json({ error: 'Already voided' }, { status: 409 })
  }

  try {
    const updated = await prisma.clientAttendanceEvent.update({
      where: { id: eventId },
      data: {
        voidedAt: new Date(),
        voidedByUserId: user.id,
        voidReason,
      },
      select: {
        id: true,
        voidedAt: true,
        voidedByUserId: true,
        voidReason: true,
      },
    })

    await logClientAccess({
      userId: user.id,
      serviceClientId: id,
      action: 'VOID_ATTENDANCE',
      ip: getClientIpFromRequest(request),
    })

    return NextResponse.json({ event: updated })
  } catch (err) {
    console.error('[attendance] void failed', err)
    return NextResponse.json(
      { error: 'Void failed — only void fields may change' },
      { status: 400 }
    )
  }
}
