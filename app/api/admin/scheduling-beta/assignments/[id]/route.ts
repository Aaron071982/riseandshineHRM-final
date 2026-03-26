import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/scheduling-beta/assignments/[id]
 * Body: { daysOfWeek?: number[], timeStart?: string|null, timeEnd?: string|null, notes?: string|null }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const patch: {
      daysOfWeek?: number[]
      timeStart?: string | null
      timeEnd?: string | null
      notes?: string | null
    } = {}

    if (Array.isArray(body.daysOfWeek)) {
      const days = body.daysOfWeek.map((d: unknown) => Number(d)).filter((n: number) => Number.isFinite(n)) as number[]
      patch.daysOfWeek = Array.from(new Set<number>(days)).sort((a: number, b: number) => a - b)
    }
    if (body.timeStart === null || typeof body.timeStart === 'string') {
      patch.timeStart = typeof body.timeStart === 'string' ? body.timeStart.trim() || null : null
    }
    if (body.timeEnd === null || typeof body.timeEnd === 'string') {
      patch.timeEnd = typeof body.timeEnd === 'string' ? body.timeEnd.trim() || null : null
    }
    if (body.notes === null || typeof body.notes === 'string') {
      patch.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    }

    if (patch.daysOfWeek && patch.daysOfWeek.length === 0) {
      return NextResponse.json({ error: 'daysOfWeek must be non-empty when provided' }, { status: 400 })
    }

    const updated = await prisma.clientAssignment.update({
      where: { id },
      data: patch,
      include: {
        client: true,
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({
      assignment: {
        id: updated.id,
        clientId: updated.schedulingClientId,
        clientName: updated.client.name,
        rbtId: updated.rbtProfileId,
        rbtName: `${updated.rbtProfile.firstName} ${updated.rbtProfile.lastName}`,
        daysOfWeek: updated.daysOfWeek,
        timeStart: updated.timeStart,
        timeEnd: updated.timeEnd,
        notes: updated.notes,
        createdAt: updated.createdAt,
      },
    })
  } catch (e) {
    console.error('[scheduling-beta] PATCH assignment error:', e)
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/scheduling-beta/assignments/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const { id } = await params
    await prisma.clientAssignment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[scheduling-beta] DELETE assignment error:', e)
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
  }
}
