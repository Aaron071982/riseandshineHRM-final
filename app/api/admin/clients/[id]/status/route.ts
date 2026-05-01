import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isCrmClientStatus } from '@/lib/crm-client/constants'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id } = await context.params

  try {
    const body = await request.json().catch(() => ({}))
    const toStatus = typeof body.toStatus === 'string' ? body.toStatus.trim() : ''
    if (!isCrmClientStatus(toStatus)) {
      return NextResponse.json({ error: 'Invalid toStatus' }, { status: 400 })
    }
    const reason = typeof body.reason === 'string' ? body.reason : null

    const existing = await prisma.crmClient.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (existing.status === toStatus) {
      return NextResponse.json({ success: true, unchanged: true })
    }

    await prisma.$transaction([
      prisma.crmClient.update({
        where: { id },
        data: { status: toStatus },
      }),
      prisma.clientStatusHistory.create({
        data: {
          clientId: id,
          fromStatus: existing.status,
          toStatus,
          changedByUserId: auth.user.id,
          reason,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[PATCH status]', e)
    return NextResponse.json({ error: 'Failed to update status', details: String(e) }, { status: 500 })
  }
}
