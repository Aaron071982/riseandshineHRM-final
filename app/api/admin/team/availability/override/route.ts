import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

const VALID_TYPES = new Set(['BLOCKED', 'CUSTOM'])

function isValidMinute(value: number) {
  return value === 0 || value === 30
}

function normalizeDateInput(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null
  const date = new Date(raw)
  if (isNaN(date.getTime())) return null
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const prismaAny = prisma as unknown as {
    adminAvailabilityOverride?: {
      findMany: (args: unknown) => Promise<Array<{
        id: string
        userId: string
        date: Date
        overrideType: string
        startHour: number | null
        startMinute: number | null
        endHour: number | null
        endMinute: number | null
        reason: string | null
        createdAt: Date
        updatedAt: Date
      }>>
    }
  }

  if (!prismaAny.adminAvailabilityOverride?.findMany) {
    const overrides = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        userId: string
        date: Date
        overrideType: string
        startHour: number | null
        startMinute: number | null
        endHour: number | null
        endMinute: number | null
        reason: string | null
        createdAt: Date
        updatedAt: Date
      }>
    >(
      `SELECT id, "userId", "date", "overrideType", "startHour", "startMinute", "endHour", "endMinute", reason, "createdAt", "updatedAt"
       FROM admin_availability_overrides
       WHERE "userId" = $1 AND "date" >= $2::date
       ORDER BY "date" ASC, "createdAt" ASC`,
      auth.user.id,
      start.toISOString().slice(0, 10)
    ).catch(() => [])
    return NextResponse.json({ overrides })
  }

  const today = new Date()
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  let overrides: Array<{
    id: string
    userId: string
    date: Date
    overrideType: string
    startHour: number | null
    startMinute: number | null
    endHour: number | null
    endMinute: number | null
    reason: string | null
    createdAt: Date
    updatedAt: Date
  }> = []
  try {
    overrides = await prismaAny.adminAvailabilityOverride.findMany({
      where: { userId: auth.user.id, date: { gte: start } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    })
  } catch {
    return NextResponse.json({ overrides: [] })
  }

  return NextResponse.json({ overrides })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const date = normalizeDateInput(body.date)
  const overrideType = typeof body.overrideType === 'string' ? body.overrideType.trim().toUpperCase() : ''

  if (!date) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }
  if (!VALID_TYPES.has(overrideType)) {
    return NextResponse.json({ error: 'Invalid override type' }, { status: 400 })
  }

  const startHour = body.startHour == null ? null : Number(body.startHour)
  const startMinute = body.startMinute == null ? null : Number(body.startMinute)
  const endHour = body.endHour == null ? null : Number(body.endHour)
  const endMinute = body.endMinute == null ? null : Number(body.endMinute)
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : null

  if (overrideType === 'CUSTOM') {
    if (
      startHour == null ||
      startMinute == null ||
      endHour == null ||
      endMinute == null ||
      startHour < 0 ||
      startHour > 23 ||
      endHour < 0 ||
      endHour > 23 ||
      !isValidMinute(startMinute) ||
      !isValidMinute(endMinute) ||
      startHour > endHour ||
      (startHour === endHour && startMinute >= endMinute)
    ) {
      return NextResponse.json({ error: 'Invalid custom hours' }, { status: 400 })
    }
  }

  const prismaAny = prisma as unknown as {
    adminAvailabilityOverride?: {
      upsert: (args: unknown) => Promise<unknown>
    }
  }

  if (!prismaAny.adminAvailabilityOverride?.upsert) {
    const id = randomUUID()
    const dateStr = date.toISOString().slice(0, 10)
    const sql = `
      INSERT INTO admin_availability_overrides
        (id, "userId", "date", "overrideType", "startHour", "startMinute", "endHour", "endMinute", reason, "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT ("userId", "date")
      DO UPDATE SET
        "overrideType" = EXCLUDED."overrideType",
        "startHour" = EXCLUDED."startHour",
        "startMinute" = EXCLUDED."startMinute",
        "endHour" = EXCLUDED."endHour",
        "endMinute" = EXCLUDED."endMinute",
        reason = EXCLUDED.reason,
        "updatedAt" = NOW()
      RETURNING id, "userId", "date", "overrideType", "startHour", "startMinute", "endHour", "endMinute", reason, "createdAt", "updatedAt"
    `
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        userId: string
        date: Date
        overrideType: string
        startHour: number | null
        startMinute: number | null
        endHour: number | null
        endMinute: number | null
        reason: string | null
        createdAt: Date
        updatedAt: Date
      }>
    >(
      sql,
      id,
      auth.user.id,
      dateStr,
      overrideType,
      overrideType === 'CUSTOM' ? startHour : null,
      overrideType === 'CUSTOM' ? startMinute : null,
      overrideType === 'CUSTOM' ? endHour : null,
      overrideType === 'CUSTOM' ? endMinute : null,
      reason || null
    ).catch(() => [])
    if (!rows.length) {
      return NextResponse.json(
        { error: 'Availability overrides table is not ready yet. Run the latest DB migration and try again.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ override: rows[0] })
  }

  let override: unknown
  try {
    override = await prismaAny.adminAvailabilityOverride.upsert({
      where: { userId_date: { userId: auth.user.id, date } },
      create: {
        userId: auth.user.id,
        date,
        overrideType,
        startHour: overrideType === 'CUSTOM' ? startHour : null,
        startMinute: overrideType === 'CUSTOM' ? startMinute : null,
        endHour: overrideType === 'CUSTOM' ? endHour : null,
        endMinute: overrideType === 'CUSTOM' ? endMinute : null,
        reason: reason || null,
      },
      update: {
        overrideType,
        startHour: overrideType === 'CUSTOM' ? startHour : null,
        startMinute: overrideType === 'CUSTOM' ? startMinute : null,
        endHour: overrideType === 'CUSTOM' ? endHour : null,
        endMinute: overrideType === 'CUSTOM' ? endMinute : null,
        reason: reason || null,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Availability overrides table is not ready yet. Run the latest DB migration and try again.' },
      { status: 503 }
    )
  }

  return NextResponse.json({ override })
}
