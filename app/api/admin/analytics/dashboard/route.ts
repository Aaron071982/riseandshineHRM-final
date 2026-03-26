import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, subDays, subWeeks, startOfWeek, endOfWeek } from 'date-fns'

type RangeKey = '7' | '30' | '90' | 'all'

function getDateRange(range: RangeKey): { start: Date | null; end: Date; prevStart: Date | null; prevEnd: Date | null } {
  const end = new Date()
  const start = range === 'all' ? null : subDays(startOfDay(end), parseInt(range, 10))
  let prevStart: Date | null = null
  let prevEnd: Date | null = null
  if (range !== 'all') {
    const n = parseInt(range, 10)
    prevEnd = start!
    prevStart = subDays(start!, n)
  }
  return { start, end, prevStart, prevEnd }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const rangeParam = request.nextUrl.searchParams.get('range') || '30'
  const range: RangeKey = ['7', '30', '90', 'all'].includes(rangeParam) ? (rangeParam as RangeKey) : '30'
  const { start, end, prevStart, prevEnd } = getDateRange(range)

  try {
    const now = new Date()

    // ---- KPIs: Total Candidates and Hired RBTs are all-time ----
    const [
      totalCandidates,
      statusCounts,
      newHiresInPeriod,
      hiredProfilesWithSubmittedAt,
      interviewsInRange,
      hiredWithTasks,
      staleCandidatesCount,
      overdueOnboardingCount,
    ] = await Promise.all([
      prisma.rBTProfile.count(),
      prisma.rBTProfile.groupBy({ by: ['status'], _count: true }),
      start
        ? prisma.rBTProfile.count({ where: { status: 'HIRED', updatedAt: { gte: start, lte: end } } })
        : Promise.resolve(0),
      start
        ? prisma.rBTProfile.findMany({
            where: { status: 'HIRED', submittedAt: { not: null }, updatedAt: { gte: start, lte: end } },
            select: { submittedAt: true, updatedAt: true },
          })
        : prisma.rBTProfile.findMany({
            where: { status: 'HIRED', submittedAt: { not: null } },
            select: { submittedAt: true, updatedAt: true },
          }),
      start
        ? prisma.interview.findMany({
            where: { scheduledAt: { gte: start, lte: end } },
            select: { status: true },
          })
        : prisma.interview.findMany({ select: { status: true } }),
      prisma.rBTProfile.findMany({
        where: { status: 'HIRED' },
        include: { onboardingTasks: true },
      }),
      prisma.rBTProfile.count({
        where: {
          status: { in: ['NEW', 'REACH_OUT', 'REACH_OUT_EMAIL_SENT', 'TO_INTERVIEW'] },
          updatedAt: { lt: subDays(now, 14) },
        },
      }),
      (async () => {
        const hired = await prisma.rBTProfile.findMany({
          where: { status: 'HIRED', updatedAt: { lt: subDays(now, 7) } },
          include: { onboardingTasks: true },
        })
        const incomplete = hired.filter((r) => {
          const tasks = r.onboardingTasks
          const total = tasks.length
          const completed = tasks.filter((t) => t.isCompleted).length
          return total > 0 && completed < total
        })
        return incomplete.length
      })(),
    ])

    const statusMap = statusCounts.reduce((acc, s) => {
      acc[s.status] = s._count
      return acc
    }, {} as Record<string, number>)

    const hiredRBTsActive = statusMap['HIRED'] ?? 0
    const totalCandidatesCurrent = totalCandidates

    let avgTimeToHireDays: number | null = null
    if (hiredProfilesWithSubmittedAt.length > 0) {
      const sumDays = hiredProfilesWithSubmittedAt.reduce((sum, p) => {
        const hire = p.updatedAt.getTime()
        const app = (p.submittedAt as Date).getTime()
        return sum + (hire - app) / (24 * 60 * 60 * 1000)
      }, 0)
      avgTimeToHireDays = Math.round(sumDays / hiredProfilesWithSubmittedAt.length)
    }

    const totalScheduled = interviewsInRange.length
    const showed = interviewsInRange.filter((i) => i.status === 'COMPLETED' || i.status === 'NO_SHOW').length
    const interviewShowRatePercent = totalScheduled > 0 ? Math.round((showed / totalScheduled) * 100) : 0

    const totalHired = hiredWithTasks.length
    const fullyCompleted = hiredWithTasks.filter((r) => {
      const tasks = r.onboardingTasks
      const total = tasks.length
      const completed = tasks.filter((t) => t.isCompleted).length
      return total > 0 && completed === total
    }).length
    const onboardingCompletionRatePercent = totalHired > 0 ? Math.round((fullyCompleted / totalHired) * 100) : 0

    const pendingActions = staleCandidatesCount + overdueOnboardingCount

    // ---- Previous period for trends ----
    let prevTotalCandidates = 0
    let prevNewHiresInPeriod = 0
    let prevAvgTimeToHireDays: number | null = null
    let prevInterviewShowRatePercent = 0
    let prevOnboardingCompletionRatePercent = 0
    let prevPendingActions = 0

    if (prevStart && prevEnd) {
      const [
        pTotal,
        pNewHires,
        pHiredWithSubmittedAt,
        pInterviews,
        pHiredWithTasksPrev,
        pStale,
        pOverdue,
      ] = await Promise.all([
        prisma.rBTProfile.count({ where: { createdAt: { lte: prevEnd } } }),
        prisma.rBTProfile.count({
          where: { status: 'HIRED', updatedAt: { gte: prevStart, lte: prevEnd } },
        }),
        prisma.rBTProfile.findMany({
          where: { status: 'HIRED', submittedAt: { not: null }, updatedAt: { gte: prevStart, lte: prevEnd } },
          select: { submittedAt: true, updatedAt: true },
        }),
        prisma.interview.findMany({
          where: { scheduledAt: { gte: prevStart, lte: prevEnd } },
          select: { status: true },
        }),
        prisma.rBTProfile.findMany({
          where: { status: 'HIRED', updatedAt: { lte: prevEnd } },
          include: { onboardingTasks: true },
        }),
        prisma.rBTProfile.count({
          where: {
            status: { in: ['NEW', 'REACH_OUT', 'REACH_OUT_EMAIL_SENT', 'TO_INTERVIEW'] },
            updatedAt: { lt: subDays(prevEnd, 14) },
          },
        }),
        (async () => {
          const hired = await prisma.rBTProfile.findMany({
            where: { status: 'HIRED', updatedAt: { lt: subDays(prevEnd!, 7), lte: prevEnd! } },
            include: { onboardingTasks: true },
          })
          return hired.filter((r) => {
            const t = r.onboardingTasks
            const total = t.length
            const completed = t.filter((x) => x.isCompleted).length
            return total > 0 && completed < total
          }).length
        })(),
      ])
      prevTotalCandidates = pTotal
      prevNewHiresInPeriod = pNewHires
      if (pHiredWithSubmittedAt.length > 0) {
        const sumDays = pHiredWithSubmittedAt.reduce((sum, p) => {
          const hire = p.updatedAt.getTime()
          const app = (p.submittedAt as Date).getTime()
          return sum + (hire - app) / (24 * 60 * 60 * 1000)
        }, 0)
        prevAvgTimeToHireDays = Math.round(sumDays / pHiredWithSubmittedAt.length)
      }
      const pScheduled = pInterviews.length
      const pShowed = pInterviews.filter((i) => i.status === 'COMPLETED' || i.status === 'NO_SHOW').length
      prevInterviewShowRatePercent = pScheduled > 0 ? Math.round((pShowed / pScheduled) * 100) : 0
      const pTotalHired = pHiredWithTasksPrev.length
      const pFullyCompleted = pHiredWithTasksPrev.filter((r) => {
        const tasks = r.onboardingTasks
        const total = tasks.length
        const completed = tasks.filter((t) => t.isCompleted).length
        return total > 0 && completed === total
      }).length
      prevOnboardingCompletionRatePercent = pTotalHired > 0 ? Math.round((pFullyCompleted / pTotalHired) * 100) : 0
      prevPendingActions = pStale + pOverdue
    }

    function trend(current: number, previous: number): { direction: 'up' | 'down' | 'neutral'; percentChange: number } {
      if (previous === 0) return { direction: current > 0 ? 'up' : 'neutral', percentChange: current > 0 ? 100 : 0 }
      const pct = Math.round(((current - previous) / previous) * 100)
      if (pct > 0) return { direction: 'up', percentChange: pct }
      if (pct < 0) return { direction: 'down', percentChange: Math.abs(pct) }
      return { direction: 'neutral', percentChange: 0 }
    }

    const kpis = {
      totalCandidates: totalCandidatesCurrent,
      hiredRBTs: hiredRBTsActive,
      avgTimeToHireDays: avgTimeToHireDays ?? 0,
      interviewShowRatePercent,
      onboardingCompletionRatePercent,
      pendingActions,
      trends: {
        totalCandidates: trend(totalCandidatesCurrent, prevTotalCandidates),
        hiredRBTs: trend(newHiresInPeriod, prevNewHiresInPeriod),
        avgTimeToHireDays:
          avgTimeToHireDays !== null && prevAvgTimeToHireDays !== null
            ? trend(avgTimeToHireDays, prevAvgTimeToHireDays)
            : { direction: 'neutral' as const, percentChange: 0 },
        interviewShowRatePercent: trend(interviewShowRatePercent, prevInterviewShowRatePercent),
        onboardingCompletionRatePercent: trend(onboardingCompletionRatePercent, prevOnboardingCompletionRatePercent),
        pendingActions: trend(pendingActions, prevPendingActions),
      },
    }

    // ---- Pipeline (all-time counts for funnel) ----
    const newCount = statusMap['NEW'] ?? 0
    const reachOutCount = (statusMap['REACH_OUT'] ?? 0) + (statusMap['REACH_OUT_EMAIL_SENT'] ?? 0)
    const toInterviewCount = statusMap['TO_INTERVIEW'] ?? 0
    const scheduledCount = statusMap['INTERVIEW_SCHEDULED'] ?? 0
    const completedCount = statusMap['INTERVIEW_COMPLETED'] ?? 0
    const hiredCountFunnel = statusMap['HIRED'] ?? 0
    const stageCounts = [newCount, reachOutCount, toInterviewCount, scheduledCount, completedCount, hiredCountFunnel]
    const stageNames = ['New', 'Reach Out', 'To Interview', 'Interview Scheduled', 'Interview Completed', 'Hired']
    const pipeline = {
      stages: stageCounts.map((count, i) => {
        const prevCount = i === 0 ? count : stageCounts[i - 1]
        const dropOffPercent =
          i > 0 && prevCount > 0 ? Math.round((1 - count / prevCount) * 100) : 0
        return { name: stageNames[i], count, dropOffPercent }
      }),
    }

    // ---- Hiring activity (last 12 weeks) ----
    const weeks: { weekLabel: string; candidatesAdded: number; hires: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`
      const [added, hires] = await Promise.all([
        prisma.rBTProfile.count({ where: { createdAt: { gte: weekStart, lte: weekEnd } } }),
        prisma.rBTProfile.count({
          where: { status: 'HIRED', updatedAt: { gte: weekStart, lte: weekEnd } },
        }),
      ])
      weeks.push({ weekLabel: label, candidatesAdded: added, hires })
    }

    // ---- Source breakdown ----
    const sourceCounts = await prisma.rBTProfile.groupBy({
      by: ['source'],
      _count: true,
    })
    const publicApplication = sourceCounts.find((s) => s.source === 'PUBLIC_APPLICATION')?._count ?? 0
    const adminCreated = sourceCounts.find((s) => s.source === 'ADMIN_CREATED')?._count ?? 0
    const sourceBreakdown = { publicApplication, adminCreated }

    // ---- Recent activity (last 10) ----
    const recentActivityRows = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, email: true, name: true } } },
    })
    const recentActivity = recentActivityRows.map((a) => ({
      id: a.id,
      action: a.action,
      activityType: a.activityType,
      createdAt: a.createdAt,
      user: a.user ? { id: a.user.id, email: a.user.email, name: a.user.name } : null,
    }))

    // ---- Upcoming interviews (next 5) ----
    const upcomingInterviews = await prisma.interview.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { gte: now } },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      include: { rbtProfile: { select: { id: true, firstName: true, lastName: true } } },
    })

    // ---- Unclaimed today count ----
    const todayStart = startOfDay(now)
    const todayEnd = new Date(todayStart.getTime() + 86400000)
    let unclaimedTodayCount = 0
    try {
      unclaimedTodayCount = await prisma.interview.count({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: todayStart, lt: todayEnd },
          claimedByUserId: null,
        },
      })
    } catch {
      // claimedByUserId column may not exist yet
    }

    // ---- Onboarding alerts (5 HIRED with lowest progress, not 100%) ----
    const onboardingProgressList = hiredWithTasks
      .map((r) => {
        const tasks = r.onboardingTasks
        const total = tasks.length
        const completed = tasks.filter((t) => t.isCompleted).length
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
        return {
          id: r.id,
          firstName: r.firstName,
          lastName: r.lastName,
          percentage,
          progress: `${completed}/${total}`,
        }
      })
      .filter((p) => p.percentage < 100)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 5)

    return NextResponse.json({
      kpis,
      pipeline,
      hiringActivity: { weeks },
      sourceBreakdown,
      recentActivity,
      upcomingInterviews,
      onboardingAlerts: onboardingProgressList,
      unclaimedTodayCount,
    })
  } catch (err) {
    console.error('[analytics/dashboard]', err)
    const message = err instanceof Error ? err.message : 'Failed to load analytics'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
