import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { activeCrmRbtAssignmentWhere } from '@/lib/crm-client/assignments'
import { startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id: clientId, assignmentId } = await context.params

  try {
    const row = await prisma.clientRbtAssignment.findFirst({
      where: { id: assignmentId, clientId },
    })
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))

    if (body.action === 'end') {
      await prisma.clientRbtAssignment.update({
        where: { id: assignmentId },
        data: {
          status: 'ENDED',
          endDate: body.endDate ? new Date(body.endDate) : startOfDay(new Date()),
        },
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'setPrimary') {
      await prisma.clientRbtAssignment.updateMany({
        where: { clientId, ...activeCrmRbtAssignmentWhere(), isPrimary: true },
        data: { isPrimary: false },
      })
      await prisma.clientRbtAssignment.update({
        where: { id: assignmentId },
        data: { isPrimary: true },
      })
      return NextResponse.json({ success: true })
    }

    const data: Record<string, unknown> = {}
    if ('isPrimary' in body) {
      const v = Boolean(body.isPrimary)
      if (v) {
        await prisma.clientRbtAssignment.updateMany({
          where: { clientId, ...activeCrmRbtAssignmentWhere(), NOT: { id: assignmentId } },
          data: { isPrimary: false },
        })
      }
      data.isPrimary = v
    }
    if ('daysOfWeek' in body && Array.isArray(body.daysOfWeek)) {
      data.daysOfWeek = body.daysOfWeek.map((x: string) => String(x).toUpperCase())
    }
    if ('timeStart' in body) data.timeStart = body.timeStart
    if ('timeEnd' in body) data.timeEnd = body.timeEnd
    if ('startDate' in body && body.startDate) data.startDate = new Date(body.startDate as string)
    if ('notes' in body) data.notes = body.notes

    await prisma.clientRbtAssignment.update({
      where: { id: assignmentId },
      data: data as object,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[PATCH rbt-assignment]', e)
    return NextResponse.json({ error: 'Failed to update assignment', details: String(e) }, { status: 500 })
  }
}
