import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function decimalHourlyToNumber(v: Prisma.Decimal | null): number | null {
  if (v == null) return null
  return Number(v)
}

/** undefined = omit; null = clear; Decimal = set */
function parseHourlyRateBody(input: unknown): { ok: true; value: Prisma.Decimal | null } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, value: null }
  if (input === null || input === '') return { ok: true, value: null }
  const raw = typeof input === 'number' ? input : typeof input === 'string' ? parseFloat(input.replace(/[^0-9.-]/g, '')) : NaN
  if (!Number.isFinite(raw) || raw < 0) return { ok: false, error: 'hourlyRate must be a non-negative number' }
  if (raw > 999_999.99) return { ok: false, error: 'hourlyRate is too large' }
  return { ok: true, value: new Prisma.Decimal(Math.round(raw * 100) / 100) }
}

/**
 * GET /api/admin/scheduling-beta/assignments?rbtId=xxx
 * List assignments. If rbtId is provided, filter by that RBT (for profile). Otherwise return all (for beta page).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const rbtId = req.nextUrl.searchParams.get('rbtId')

    const where = rbtId ? { rbtProfileId: rbtId } : {}

    const rows = await prisma.clientAssignment.findMany({
      where,
      include: {
        client: true,
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    const assignments = rows.map((a) => ({
      id: a.id,
      clientId: a.schedulingClientId,
      clientName: a.client.name,
      rbtId: a.rbtProfileId,
      rbtName: `${a.rbtProfile.firstName} ${a.rbtProfile.lastName}`,
      daysOfWeek: a.daysOfWeek,
      timeStart: a.timeStart,
      timeEnd: a.timeEnd,
      hourlyRate: decimalHourlyToNumber(a.hourlyRate),
      notes: a.notes,
      createdAt: a.createdAt,
    }))

    return NextResponse.json({ assignments })
  } catch (e) {
    console.error('[scheduling-beta] GET assignments error:', e)
    return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 })
  }
}

/**
 * POST /api/admin/scheduling-beta/assignments
 * Body: { client?: { name, addressLine1?, city?, state?, zip? }, clientId?: string, rbtProfileId, daysOfWeek: number[], timeStart?, timeEnd?, notes? }
 * If client is provided (and no clientId), create SchedulingClient then create assignment. Otherwise require clientId.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const body = await req.json()
    const { client, clientId, rbtProfileId, daysOfWeek, timeStart, timeEnd, notes, hourlyRate: hourlyRateRaw } = body

    if (!rbtProfileId || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return NextResponse.json({ error: 'rbtProfileId and daysOfWeek (non-empty) required' }, { status: 400 })
    }

    let schedulingClientId: string

    if (clientId && typeof clientId === 'string') {
      const existing = await prisma.schedulingClient.findUnique({ where: { id: clientId } })
      if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      schedulingClientId = clientId
    } else if (client && typeof client.name === 'string' && client.name.trim()) {
      const created = await prisma.schedulingClient.create({
        data: {
          name: client.name.trim(),
          addressLine1: client.addressLine1?.trim() ?? null,
          addressLine2: client.addressLine2?.trim() ?? null,
          city: client.city?.trim() ?? null,
          state: client.state?.trim() ?? null,
          zip: client.zip?.trim() ?? null,
          preferredRbtEthnicity: client.preferredRbtEthnicity?.trim() ?? null,
        },
      })
      schedulingClientId = created.id
    } else {
      return NextResponse.json({ error: 'Provide clientId or client { name, ... }' }, { status: 400 })
    }

    const hr = parseHourlyRateBody(hourlyRateRaw)
    if (!hr.ok) return NextResponse.json({ error: hr.error }, { status: 400 })

    const assignment = await prisma.clientAssignment.create({
      data: {
        rbtProfileId,
        schedulingClientId,
        daysOfWeek: daysOfWeek.map((d: number) => Number(d)),
        timeStart: timeStart?.trim() || null,
        timeEnd: timeEnd?.trim() || null,
        hourlyRate: hr.value,
        notes: notes?.trim() || null,
      },
      include: {
        client: true,
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        clientId: assignment.schedulingClientId,
        clientName: assignment.client.name,
        rbtId: assignment.rbtProfileId,
        rbtName: `${assignment.rbtProfile.firstName} ${assignment.rbtProfile.lastName}`,
        daysOfWeek: assignment.daysOfWeek,
        timeStart: assignment.timeStart,
        timeEnd: assignment.timeEnd,
        hourlyRate: decimalHourlyToNumber(assignment.hourlyRate),
        notes: assignment.notes,
        createdAt: assignment.createdAt,
      },
    })
  } catch (e) {
    console.error('[scheduling-beta] POST assignment error:', e)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
