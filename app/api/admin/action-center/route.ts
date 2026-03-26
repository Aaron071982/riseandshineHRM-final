import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getWorkflowSettings } from '@/lib/workflow-settings'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'

type Severity = 'URGENT' | 'WARNING' | 'INFO'

export interface ActionCenterSection {
  id: string
  title: string
  severity: Severity
  count: number
  items: Record<string, unknown>[]
}

async function getCounts(): Promise<{ urgent: number; warning: number; info: number }> {
  const now = new Date()
  const workflow = await getWorkflowSettings()
  const dayMs = 24 * 60 * 60 * 1000
  const reachOutThreshold = subDays(now, workflow.stalenessDaysReachOut)
  const toInterviewThreshold = subDays(now, workflow.stalenessDaysToInterview)
  const onboardingThreshold = subDays(now, workflow.stalenessDaysOnboarding)
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const fortyEightHoursAgo = subDays(now, 2)

  const [
    interviewsNotCompleteCount,
    onboardingBlockedCount,
    staleReachOutCount,
    staleToInterviewCount,
    interviewsTodayCount,
    leavePendingCount,
    newAppsCount,
    onboardingNearlyCount,
    flaggedSessionsCount,
  ] = await Promise.all([
    prisma.interview.count({
      where: { status: 'SCHEDULED', scheduledAt: { lt: now } },
    }),
    (async () => {
      const hired = await prisma.rBTProfile.findMany({
        where: { status: 'HIRED', updatedAt: { lt: onboardingThreshold } },
        include: { onboardingTasks: { select: { isCompleted: true } } },
      })
      return hired.filter((p) => {
        const total = p.onboardingTasks.length
        const completed = p.onboardingTasks.filter((t) => t.isCompleted).length
        return total > 0 && (100 * completed) / total === 0
      }).length
    })(),
    prisma.rBTProfile.count({
      where: {
        status: { in: ['REACH_OUT', 'REACH_OUT_EMAIL_SENT'] },
        updatedAt: { lt: reachOutThreshold },
      },
    }),
    prisma.rBTProfile.count({
      where: { status: 'TO_INTERVIEW', updatedAt: { lt: toInterviewThreshold } },
    }),
    prisma.interview.count({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
    prisma.rBTProfile.count({
      where: { status: 'NEW', createdAt: { gte: fortyEightHoursAgo } },
    }),
    (async () => {
      const hired = await prisma.rBTProfile.findMany({
        where: { status: 'HIRED' },
        include: { onboardingTasks: { select: { isCompleted: true } } },
      })
      return hired.filter((p) => {
        const total = p.onboardingTasks.length
        if (total === 0) return false
        const completed = p.onboardingTasks.filter((t) => t.isCompleted).length
        const pct = Math.round((100 * completed) / total)
        return pct >= 71 && pct <= 99
      }).length
    })(),
    (async () => {
      const entries = await prisma.timeEntry.findMany({
        where: { rbtProfile: { status: 'HIRED' } },
        select: { clockInTime: true, clockOutTime: true, totalHours: true },
      })
      return entries.filter((e) => {
        if (e.clockOutTime == null) {
          const openHours = (now.getTime() - e.clockInTime.getTime()) / 3600000
          return openHours >= 8
        }
        return (e.totalHours ?? 0) > 8
      }).length
    })(),
  ])

  const urgent = interviewsNotCompleteCount + onboardingBlockedCount + flaggedSessionsCount
  const warning = staleReachOutCount + staleToInterviewCount + interviewsTodayCount + leavePendingCount
  const info = newAppsCount + onboardingNearlyCount
  return { urgent, warning, info }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const countOnly = request.nextUrl.searchParams.get('countOnly') === '1'
    if (countOnly) {
      try {
        const counts = await getCounts()
        return NextResponse.json(counts)
      } catch (err) {
        console.error('[action-center] getCounts failed:', err)
        return NextResponse.json({ urgent: 0, warning: 0, info: 0 })
      }
    }

    const now = new Date()
    const workflow = await getWorkflowSettings()
  const dayMs = 24 * 60 * 60 * 1000
  const reachOutThreshold = subDays(now, workflow.stalenessDaysReachOut)
  const toInterviewThreshold = subDays(now, workflow.stalenessDaysToInterview)
  const onboardingThreshold = subDays(now, workflow.stalenessDaysOnboarding)
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const fortyEightHoursAgo = subDays(now, 2)

  const [
    interviewsNotComplete,
    onboardingBlocked,
    staleReachOut,
    staleToInterview,
    interviewsToday,
    leavePending,
    newApps,
    hiredWithTasks,
    flaggedSessions,
  ] = await Promise.all([
    prisma.interview.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lt: now } },
      include: { rbtProfile: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { scheduledAt: 'asc' },
    }),
    (async () => {
      const hired = await prisma.rBTProfile.findMany({
        where: { status: 'HIRED', updatedAt: { lt: onboardingThreshold } },
        include: { onboardingTasks: { select: { isCompleted: true } } },
      })
      return hired.filter((p) => {
        const total = p.onboardingTasks.length
        const completed = p.onboardingTasks.filter((t) => t.isCompleted).length
        return total > 0 && (100 * completed) / total === 0
      })
    })(),
    prisma.rBTProfile.findMany({
      where: {
        status: { in: ['REACH_OUT', 'REACH_OUT_EMAIL_SENT'] },
        updatedAt: { lt: reachOutThreshold },
      },
      select: { id: true, firstName: true, lastName: true, status: true, updatedAt: true, phoneNumber: true, email: true },
    }),
    prisma.rBTProfile.findMany({
      where: { status: 'TO_INTERVIEW', updatedAt: { lt: toInterviewThreshold } },
      select: { id: true, firstName: true, lastName: true, status: true, updatedAt: true, phoneNumber: true, email: true },
    }),
    (async () => {
      try {
        return await prisma.interview.findMany({
          where: { status: 'SCHEDULED', scheduledAt: { gte: todayStart, lte: todayEnd } },
          include: {
            rbtProfile: { select: { id: true, firstName: true, lastName: true } },
            claimedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { scheduledAt: 'asc' },
        })
      } catch {
        const rows = await prisma.interview.findMany({
          where: { status: 'SCHEDULED', scheduledAt: { gte: todayStart, lte: todayEnd } },
          include: { rbtProfile: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { scheduledAt: 'asc' },
        })
        return rows.map((r) => ({ ...r, claimedByUserId: null as string | null, claimedBy: null as { id: string; name: string | null; email: string | null } | null }))
      }
    })(),
    prisma.leaveRequest.findMany({
      where: { status: 'PENDING' },
      include: { rbtProfile: { select: { firstName: true, lastName: true } } },
    }),
    prisma.rBTProfile.findMany({
      where: { status: 'NEW', createdAt: { gte: fortyEightHoursAgo } },
      select: { id: true, firstName: true, lastName: true, createdAt: true, source: true, locationCity: true, locationState: true },
    }),
    prisma.rBTProfile.findMany({
      where: { status: 'HIRED' },
      include: { onboardingTasks: { select: { isCompleted: true } } },
    }),
    prisma.timeEntry.findMany({
      where: {
        rbtProfile: { status: 'HIRED' },
      },
      select: {
        id: true,
        rbtProfileId: true,
        clockInTime: true,
        clockOutTime: true,
        totalHours: true,
        rbtProfile: { select: { firstName: true, lastName: true } },
      },
      orderBy: { clockInTime: 'desc' },
      take: 200,
    }),
  ])

  const onboardingNearlyComplete = hiredWithTasks.filter((p) => {
    const total = p.onboardingTasks.length
    if (total === 0) return false
    const completed = p.onboardingTasks.filter((t) => t.isCompleted).length
    const pct = Math.round((100 * completed) / total)
    return pct >= 71 && pct <= 99
    })

    const sections: ActionCenterSection[] = []

    const hasUnclaimed = interviewsToday.some((i) => !i.claimedByUserId)
    sections.push({
      id: 'flagged-sessions',
      title: 'Flagged sessions',
      severity: 'URGENT',
      count: flaggedSessions.filter((s) => {
        if (s.clockOutTime == null) {
          const openHours = (now.getTime() - s.clockInTime.getTime()) / 3600000
          return openHours >= 8
        }
        return (s.totalHours ?? 0) > 8
      }).length,
      items: flaggedSessions
        .filter((s) => {
          if (s.clockOutTime == null) {
            const openHours = (now.getTime() - s.clockInTime.getTime()) / 3600000
            return openHours >= 8
          }
          return (s.totalHours ?? 0) > 8
        })
        .map((s) => ({
          id: s.id,
          rbtProfileId: s.rbtProfileId,
          rbtName: `${s.rbtProfile.firstName} ${s.rbtProfile.lastName}`,
          clockInTime: s.clockInTime,
          hoursElapsed:
            s.clockOutTime == null
              ? Math.round(((now.getTime() - s.clockInTime.getTime()) / 3600000) * 100) / 100
              : s.totalHours ?? 0,
        })),
    })

    sections.push({
    id: 'interviews-today',
    title: hasUnclaimed ? 'Interviews today (unclaimed!)' : 'Interviews coming up today',
    severity: hasUnclaimed ? 'URGENT' : 'WARNING',
    count: interviewsToday.length,
    items: interviewsToday.map((i) => ({
      id: i.id,
      rbtProfileId: i.rbtProfileId,
      candidateName: `${i.rbtProfile.firstName} ${i.rbtProfile.lastName}`,
      scheduledAt: i.scheduledAt,
      interviewerName: i.interviewerName,
      meetingUrl: i.meetingUrl ?? undefined,
      claimedByUserId: i.claimedByUserId,
      claimedByName: i.claimedBy?.name || i.claimedBy?.email || null,
    })),
    })

    sections.push({
    id: 'interviews-not-complete',
    title: 'Interviews not marked complete',
    severity: 'URGENT',
    count: interviewsNotComplete.length,
    items: interviewsNotComplete.map((i) => {
      const daysOverdue = Math.floor((now.getTime() - i.scheduledAt.getTime()) / dayMs)
      return {
        id: i.id,
        rbtProfileId: i.rbtProfileId,
        candidateName: `${i.rbtProfile.firstName} ${i.rbtProfile.lastName}`,
        scheduledAt: i.scheduledAt,
        interviewerName: i.interviewerName,
        daysOverdue,
      }
    }),
  })

  sections.push({
    id: 'onboarding-blocked',
    title: 'Onboarding blocked',
    severity: 'URGENT',
    count: onboardingBlocked.length,
    items: onboardingBlocked.map((p) => {
      const daysSinceHired = Math.floor((now.getTime() - p.updatedAt.getTime()) / dayMs)
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        hireDate: p.updatedAt,
        daysSinceHired,
        phoneNumber: p.phoneNumber,
        email: p.email ?? undefined,
      }
    }),
    })

    const staleReachOutItems = staleReachOut.map((p) => {
    const daysStale = Math.floor((now.getTime() - p.updatedAt.getTime()) / dayMs)
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      status: p.status,
      daysStale,
      phoneNumber: p.phoneNumber,
      email: p.email ?? undefined,
      group: 'REACH_OUT' as const,
    }
    })
    const staleToInterviewItems = staleToInterview.map((p) => {
    const daysStale = Math.floor((now.getTime() - p.updatedAt.getTime()) / dayMs)
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      status: p.status,
      daysStale,
      phoneNumber: p.phoneNumber,
      email: p.email ?? undefined,
      group: 'TO_INTERVIEW' as const,
    }
    })

    sections.push({
    id: 'stale-candidates',
    title: 'Stale candidates',
    severity: 'WARNING',
    count: staleReachOutItems.length + staleToInterviewItems.length,
    items: [...staleReachOutItems, ...staleToInterviewItems],
    })

    sections.push({
    id: 'leave-requests',
    title: 'Pending leave requests',
    severity: 'WARNING',
    count: leavePending.length,
    items: leavePending.map((lr) => ({
      id: lr.id,
      rbtName: `${lr.rbtProfile.firstName} ${lr.rbtProfile.lastName}`,
      type: lr.type,
      startDate: lr.startDate,
      endDate: lr.endDate,
      reason: lr.reason ?? undefined,
    })),
    })

    sections.push({
    id: 'new-applications',
    title: 'New applications (last 48 hours)',
    severity: 'INFO',
    count: newApps.length,
    items: newApps.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      createdAt: p.createdAt,
      source: p.source ?? undefined,
      locationCity: p.locationCity ?? undefined,
      locationState: p.locationState ?? undefined,
    })),
  })

  sections.push({
    id: 'onboarding-nearly-complete',
    title: 'Onboarding nearly complete',
    severity: 'INFO',
    count: onboardingNearlyComplete.length,
    items: onboardingNearlyComplete.map((p) => {
      const total = p.onboardingTasks.length
      const completed = p.onboardingTasks.filter((t) => t.isCompleted).length
      const percentage = total > 0 ? Math.round((100 * completed) / total) : 0
      const tasksRemaining = total - completed
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        percentage,
        tasksRemaining,
      }
    }),
    })

    const scheduleCandidates = await prisma.rBTProfile.findMany({
    where: { status: { in: ['TO_INTERVIEW', 'REACH_OUT', 'REACH_OUT_EMAIL_SENT'] } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    })

    return NextResponse.json({ sections, scheduleCandidates })
  } catch (err) {
    console.error('[action-center] GET failed:', err)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? String(err) : 'Failed to load action center' },
      { status: 500 }
    )
  }
}
