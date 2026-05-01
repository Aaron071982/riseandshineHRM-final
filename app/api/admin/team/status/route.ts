import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['ONLINE', 'AWAY', 'BUSY', 'OFFLINE', 'IN_INTERVIEW', 'IN_SESSION'])
const inMemoryStatusStore = new Map<
  string,
  { status: string; statusEmoji: string | null; statusMessage: string | null; statusExpiresAt: Date | null; lastSeenAt: Date }
>()

export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const prismaAny = prisma as unknown as {
    adminStatus?: {
      findMany: (args: unknown) => Promise<Array<{ userId: string; status: string; statusEmoji: string | null; statusMessage: string | null; statusExpiresAt: Date | null; lastSeenAt: Date | null }>>
    }
    interviewerAvailability?: {
      findMany: (args: unknown) => Promise<Array<{ userId: string; dayOfWeek: number }>>
    }
    adminAvailability?: {
      findMany: (args: unknown) => Promise<Array<{ userId: string; dayOfWeek: number }>>
    }
    adminAvailabilityOverride?: {
      findMany: (args: unknown) => Promise<Array<{ userId: string; date: Date; overrideType: string }>>
    }
  }

  const today = new Date()
  const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const [admins, statusesDb, availability, overrides] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }],
    }),
    prismaAny.adminStatus?.findMany
      ? prismaAny.adminStatus.findMany({
          select: {
            userId: true,
            status: true,
            statusEmoji: true,
            statusMessage: true,
            statusExpiresAt: true,
            lastSeenAt: true,
          },
        }).catch(() => [])
      : Promise.resolve([]),
    prismaAny.adminAvailability?.findMany
      ? prismaAny.adminAvailability.findMany({
          where: { isActive: true },
          select: { userId: true, dayOfWeek: true },
        }).catch(() => [])
      : prismaAny.interviewerAvailability?.findMany
      ? prismaAny.interviewerAvailability.findMany({
          where: { isActive: true },
          select: { userId: true, dayOfWeek: true },
        }).catch(() => [])
      : Promise.resolve([]),
    prismaAny.adminAvailabilityOverride?.findMany
      ? prismaAny.adminAvailabilityOverride.findMany({
          where: { date: { gte: startOfToday } },
          select: { userId: true, date: true, overrideType: true },
        }).catch(() => [])
      : Promise.resolve([]),
  ])

  const statuses = statusesDb.length
    ? statusesDb
    : Array.from(inMemoryStatusStore.entries()).map(([userId, row]) => ({
        userId,
        status: row.status,
        statusEmoji: row.statusEmoji,
        statusMessage: row.statusMessage,
        statusExpiresAt: row.statusExpiresAt,
        lastSeenAt: row.lastSeenAt,
      }))

  const now = new Date()
  const statusByUser = new Map(statuses.map((s) => [s.userId, s]))
  const dayPillsByUser = new Map<string, number[]>()
  const blockedDayKeys = new Set(
    overrides.filter((o) => o.overrideType === 'BLOCKED').map((o) => `${o.userId}:${o.date.toISOString().slice(0, 10)}`)
  )
  for (const row of availability) {
    const now = new Date()
    const day = new Date(now)
    day.setDate(now.getDate() + ((row.dayOfWeek - now.getDay() + 7) % 7))
    const dayKey = day.toISOString().slice(0, 10)
    if (blockedDayKeys.has(`${row.userId}:${dayKey}`)) continue
    const arr = dayPillsByUser.get(row.userId) ?? []
    if (!arr.includes(row.dayOfWeek)) arr.push(row.dayOfWeek)
    dayPillsByUser.set(row.userId, arr)
  }

  const team = admins.map((admin) => {
    const row = statusByUser.get(admin.id)
    const expired = row?.statusExpiresAt ? row.statusExpiresAt <= now : false
    const effectiveStatus = expired ? 'OFFLINE' : row?.status ?? 'OFFLINE'
    return {
      userId: admin.id,
      name: admin.name ?? admin.email ?? 'Admin',
      email: admin.email,
      status: effectiveStatus,
      statusEmoji: row?.statusEmoji ?? null,
      statusMessage: row?.statusMessage ?? null,
      statusExpiresAt: row?.statusExpiresAt ?? null,
      lastSeenAt: row?.lastSeenAt ?? null,
      availabilityDays: (dayPillsByUser.get(admin.id) ?? []).sort((a, b) => a - b),
    }
  })

  return NextResponse.json({
    currentUserId: auth.user.id,
    team,
    onlineCount: team.filter((x) => ['ONLINE', 'IN_INTERVIEW', 'IN_SESSION'].includes(x.status)).length,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : 'ONLINE'
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const statusMessage = typeof body.statusMessage === 'string' ? body.statusMessage.trim().slice(0, 200) : null
  const statusEmoji = typeof body.statusEmoji === 'string' ? body.statusEmoji.trim().slice(0, 8) : null
  const statusExpiresAt =
    typeof body.statusExpiresAt === 'string' && body.statusExpiresAt
      ? new Date(body.statusExpiresAt)
      : null

  const prismaAny = prisma as unknown as {
    adminStatus?: {
      upsert: (args: unknown) => Promise<{ status: string }>
    }
  }

  if (prismaAny.adminStatus?.upsert) {
    const result = await prismaAny.adminStatus.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
        status,
        statusMessage: statusMessage || null,
        statusEmoji: statusEmoji || null,
        statusExpiresAt: statusExpiresAt && !isNaN(statusExpiresAt.getTime()) ? statusExpiresAt : null,
        lastSeenAt: new Date(),
      },
      update: {
        status,
        statusMessage: statusMessage || null,
        statusEmoji: statusEmoji || null,
        statusExpiresAt: statusExpiresAt && !isNaN(statusExpiresAt.getTime()) ? statusExpiresAt : null,
        lastSeenAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, status: result.status })
  }

  // Fallback when admin_status model is not yet in generated Prisma client.
  inMemoryStatusStore.set(auth.user.id, {
    status,
    statusEmoji: statusEmoji || null,
    statusMessage: statusMessage || null,
    statusExpiresAt: statusExpiresAt && !isNaN(statusExpiresAt.getTime()) ? statusExpiresAt : null,
    lastSeenAt: new Date(),
  })

  return NextResponse.json({ success: true, status })
}
