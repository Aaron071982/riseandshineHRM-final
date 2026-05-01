import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#22C55E', '#EF4444', '#14B8A6', '#F59E0B', '#6366F1']

function asDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback : d
}

function isoDayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const params = request.nextUrl.searchParams
  const start = asDate(params.get('startDate'), new Date())
  const end = asDate(params.get('endDate'), new Date(start.getTime() + 7 * 86400000))

  const prismaAny = prisma as unknown as {
    adminAvailability?: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: string
          userId: string
          dayOfWeek: number
          startHour: number
          startMinute: number
          endHour: number
          endMinute: number
          label: string | null
          color: string
        }>
      >
    }
    interviewerAvailability?: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: string
          userId: string
          dayOfWeek: number
          startHour: number
          startMinute: number
          endHour: number
          endMinute: number
          isActive: boolean
        }>
      >
    }
    adminCalendarNote?: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: string
          userId: string
          date: Date
          content: string
          color: string | null
          isPinned: boolean
          createdAt: Date
          user: { name: string | null; email: string | null }
        }>
      >
    }
    adminStatus?: {
      findMany: (args: unknown) => Promise<
        Array<{ userId: string; status: string; statusEmoji: string | null; statusMessage: string | null; statusExpiresAt: Date | null; lastSeenAt: Date | null }>
      >
    }
    adminAvailabilityOverride?: {
      findMany: (args: unknown) => Promise<
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
        }>
      >
    }
  }

  const [admins, availabilityRaw, interviews, notes, statuses, overrides] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }],
    }),
    prismaAny.adminAvailability?.findMany
      ? prismaAny.adminAvailability.findMany({
          where: { isActive: true },
          select: {
            id: true,
            userId: true,
            dayOfWeek: true,
            startHour: true,
            startMinute: true,
            endHour: true,
            endMinute: true,
            label: true,
            color: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }, { startMinute: 'asc' }],
        }).catch(() => [])
      : prismaAny.interviewerAvailability?.findMany
        ? prismaAny.interviewerAvailability.findMany({
            where: { isActive: true },
            select: {
              id: true,
              userId: true,
              dayOfWeek: true,
              startHour: true,
              startMinute: true,
              endHour: true,
              endMinute: true,
              isActive: true,
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }, { startMinute: 'asc' }],
          }).catch(() => [])
        : Promise.resolve([]),
    prisma.interview.findMany({
      where: {
        scheduledAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        interviewerName: true,
        meetingUrl: true,
        status: true,
        claimedBy: { select: { id: true, name: true, email: true } },
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    }),
    prismaAny.adminCalendarNote?.findMany
      ? prismaAny.adminCalendarNote.findMany({
          where: { date: { gte: start, lte: end } },
          select: {
            id: true,
            userId: true,
            date: true,
            content: true,
            color: true,
            isPinned: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
          },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        }).catch(() => [])
      : Promise.resolve([]),
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
    prismaAny.adminAvailabilityOverride?.findMany
      ? prismaAny.adminAvailabilityOverride.findMany({
          where: { date: { gte: start, lte: end } },
          select: {
            id: true,
            userId: true,
            date: true,
            overrideType: true,
            startHour: true,
            startMinute: true,
            endHour: true,
            endMinute: true,
            reason: true,
          },
          orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
        }).catch(() => [])
      : Promise.resolve([]),
  ])

  const availability = availabilityRaw.map((a) => ({
    ...a,
    label: 'label' in a ? (a.label ?? null) : null,
    color: 'color' in a ? (a.color as string) : '',
  }))

  const colorByUser = new Map<string, string>()
  admins.forEach((a, i) => colorByUser.set(a.id, DEFAULT_COLORS[i % DEFAULT_COLORS.length]))
  availability.forEach((a) => {
    if (a.color) colorByUser.set(a.userId, a.color)
  })

  const overrideByUserDate = new Map<string, (typeof overrides)[number]>()
  overrides.forEach((o) => overrideByUserDate.set(`${o.userId}:${isoDayKey(o.date)}`, o))

  const effectiveAvailability: Array<{
    id: string
    userId: string
    dayOfWeek: number
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
    label: string | null
    color: string
    date: string
    source: 'RECURRING' | 'CUSTOM_OVERRIDE' | 'BLOCKED_OVERRIDE'
    reason: string | null
    overrideId: string | null
  }> = []

  const daySpan = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
  for (let i = 0; i <= daySpan; i += 1) {
    const day = new Date(start.getTime() + i * 86400000)
    const dayKey = isoDayKey(day)
    const dayOfWeek = day.getDay()
    for (const admin of admins) {
      const override = overrideByUserDate.get(`${admin.id}:${dayKey}`)
      if (override?.overrideType === 'BLOCKED') {
        effectiveAvailability.push({
          id: `blocked-${admin.id}-${dayKey}`,
          userId: admin.id,
          dayOfWeek,
          startHour: 7,
          startMinute: 0,
          endHour: 22,
          endMinute: 0,
          label: 'Blocked',
          color: '#9CA3AF',
          date: dayKey,
          source: 'BLOCKED_OVERRIDE',
          reason: override.reason ?? null,
          overrideId: override.id,
        })
        continue
      }

      if (override?.overrideType === 'CUSTOM' && override.startHour != null && override.startMinute != null && override.endHour != null && override.endMinute != null) {
        effectiveAvailability.push({
          id: `custom-${override.id}`,
          userId: admin.id,
          dayOfWeek,
          startHour: override.startHour,
          startMinute: override.startMinute,
          endHour: override.endHour,
          endMinute: override.endMinute,
          label: 'Custom hours',
          color: colorByUser.get(admin.id) || DEFAULT_COLORS[0],
          date: dayKey,
          source: 'CUSTOM_OVERRIDE',
          reason: override.reason ?? null,
          overrideId: override.id,
        })
        continue
      }

      availability
        .filter((a) => a.userId === admin.id && a.dayOfWeek === dayOfWeek)
        .forEach((a) => {
          effectiveAvailability.push({
            id: `${a.id}-${dayKey}`,
            userId: a.userId,
            dayOfWeek,
            startHour: a.startHour,
            startMinute: a.startMinute,
            endHour: a.endHour,
            endMinute: a.endMinute,
            label: a.label,
            color: a.color || colorByUser.get(a.userId) || DEFAULT_COLORS[0],
            date: dayKey,
            source: 'RECURRING',
            reason: null,
            overrideId: null,
          })
        })
    }
  }

  const conflicts = interviews
    .map((i) => {
      const day = isoDayKey(i.scheduledAt)
      const interviewerUserId = i.claimedBy?.id ?? null
      if (!interviewerUserId) return null
      const override = overrideByUserDate.get(`${interviewerUserId}:${day}`)
      if (!override || override.overrideType !== 'BLOCKED') return null
      return {
        interviewId: i.id,
        date: day,
        interviewerUserId,
        interviewerName: i.claimedBy?.name ?? i.claimedBy?.email ?? i.interviewerName,
        reason: override.reason ?? null,
        message: `${i.claimedBy?.name ?? i.claimedBy?.email ?? i.interviewerName} has this day blocked but has an interview scheduled.`,
      }
    })
    .filter(Boolean)

  return NextResponse.json({
    currentUserId: auth.user.id,
    admins: admins.map((a) => ({
      id: a.id,
      name: a.name ?? a.email ?? 'Admin',
      email: a.email,
      color: colorByUser.get(a.id) ?? DEFAULT_COLORS[0],
    })),
    availability: availability.map((a) => ({
      ...a,
      color: a.color || colorByUser.get(a.userId) || DEFAULT_COLORS[0],
    })),
    overrides: overrides.map((o) => ({
      ...o,
      date: isoDayKey(o.date),
    })),
    effectiveAvailability,
    interviews: interviews.map((i) => ({
      id: i.id,
      scheduledAt: i.scheduledAt,
      durationMinutes: i.durationMinutes,
      interviewerName: i.interviewerName,
      meetingUrl: i.meetingUrl,
      status: i.status,
      candidate: i.rbtProfile
        ? { id: i.rbtProfile.id, name: `${i.rbtProfile.firstName} ${i.rbtProfile.lastName}` }
        : null,
      interviewer: i.claimedBy
        ? { id: i.claimedBy.id, name: i.claimedBy.name ?? i.claimedBy.email ?? i.interviewerName }
        : null,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      userId: n.userId,
      date: n.date,
      content: n.content,
      color: n.color,
      isPinned: n.isPinned,
      createdAt: n.createdAt,
      authorName: n.user.name ?? n.user.email ?? 'Admin',
    })),
    statuses,
    conflicts,
  })
}
