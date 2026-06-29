import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  if (body.action !== 'resolve') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const existing = await prisma.artemisSessionRequest.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }
  if (existing.status === 'RESOLVED') {
    return NextResponse.json({ success: true })
  }

  await prisma.artemisSessionRequest.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedByUserId: auth.user.id,
    },
  })

  return NextResponse.json({ success: true })
}
