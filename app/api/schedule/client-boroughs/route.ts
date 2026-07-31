import { NextRequest, NextResponse } from 'next/server'
import { requireScheduleSession } from '@/lib/schedule/access'
import { prisma } from '@/lib/prisma'
import { CLIENT_BOROUGH_OPTIONS } from '@/lib/schedule-import/boroughOptions'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response

  const rows = await prisma.clientBorough.findMany({
    orderBy: [{ borough: 'asc' }, { clientName: 'asc' }],
  })
  return NextResponse.json({
    clients: rows,
    options: CLIENT_BOROUGH_OPTIONS,
    unsetCount: rows.filter((r) => r.borough === 'Unset' || !r.borough).length,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response
  const user = auth.user!

  const body = await request.json()
  const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : ''
  const borough = typeof body.borough === 'string' ? body.borough.trim() : 'Unset'
  if (!clientName) {
    return NextResponse.json({ error: 'clientName required' }, { status: 400 })
  }

  const row = await prisma.clientBorough.upsert({
    where: { clientName },
    create: {
      clientName,
      borough: borough || 'Unset',
      notes: typeof body.notes === 'string' ? body.notes : null,
      updatedById: user.id,
    },
    update: {
      borough: borough || 'Unset',
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      updatedById: user.id,
    },
  })

  // Denormalize onto active assignments for this client
  await prisma.rbtScheduleAssignment.updateMany({
    where: { clientName, isActive: true },
    data: { clientBorough: row.borough },
  })
  await prisma.scheduleWeeklyClient.updateMany({
    where: { name: { equals: clientName, mode: 'insensitive' } },
    data: { borough: row.borough === 'Unset' ? null : row.borough },
  })

  return NextResponse.json({ client: row })
}
