import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function decimalHourlyToNumber(v: Prisma.Decimal | null): number | null {
  if (v == null) return null
  return Number(v)
}

function parseHourlyRatePatch(input: unknown): { ok: true; value: Prisma.Decimal | null } | { ok: false; error: string } {
  if (input === null || input === '') return { ok: true, value: null }
  const raw = typeof input === 'number' ? input : typeof input === 'string' ? parseFloat(input.replace(/[^0-9.-]/g, '')) : NaN
  if (!Number.isFinite(raw) || raw < 0) return { ok: false, error: 'hourlyRate must be a non-negative number' }
  if (raw > 999_999.99) return { ok: false, error: 'hourlyRate is too large' }
  return { ok: true, value: new Prisma.Decimal(Math.round(raw * 100) / 100) }
}

/**
 * PATCH /api/admin/scheduling-beta/assignments/[id]
 * Body: { daysOfWeek?: number[], timeStart?: string|null, timeEnd?: string|null, hourlyRate?: number|null|string, notes?: string|null }
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
      hourlyRate?: Prisma.Decimal | null
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
    if ('hourlyRate' in body) {
      const hr = parseHourlyRatePatch(body.hourlyRate)
      if (!hr.ok) return NextResponse.json({ error: hr.error }, { status: 400 })
      patch.hourlyRate = hr.value
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
        hourlyRate: decimalHourlyToNumber(updated.hourlyRate),
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
