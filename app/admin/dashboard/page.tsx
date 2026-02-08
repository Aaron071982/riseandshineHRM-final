import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import TrackedLink from '@/components/tracking/TrackedLink'
import { formatDate } from '@/lib/utils'
import { Plus, Users, Calendar, FileCheck, Clock, TrendingUp, UserPlus, CheckCircle } from 'lucide-react'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboard() {
  // Get current admin user (guard so session/DB failure doesn't crash the page)
  let user: Awaited<ReturnType<typeof validateSession>> = null
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    user = sessionToken ? await validateSession(sessionToken) : null
  } catch (e) {
    console.error('Admin dashboard: session check failed', e)
  }
  const adminEmail = user?.email || ''

  // Fetch statistics with error handling
  let totalCandidates = 0
  let candidatesByStatus: Array<{ status: string; _count: number }> = []
  let upcomingInterviews: any[] = []
  let recentHires: any[] = []
  let pendingOnboarding: Array<{ rbtProfileId: string; _count: { id: number } }> = []
  let dashboardLoadError = false

  try {
    const results = await Promise.all([
    prisma.rBTProfile.count(),
    prisma.rBTProfile.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.interview.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
      },
      include: { rbtProfile: true },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    }),
    prisma.rBTProfile.findMany({
      where: {
        status: 'HIRED',
      },
      include: {
        user: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
    }),
      prisma.onboardingTask.groupBy({
        by: ['rbtProfileId'],
        where: {
          isCompleted: false,
        },
        _count: {
          id: true,
        },
      }),
    ])

    totalCandidates = results[0]
    candidatesByStatus = results[1]
    upcomingInterviews = results[2]
    recentHires = results[3]
    pendingOnboarding = results[4]
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; meta?: unknown; stack?: string }
    console.error('❌ Database connection error in AdminDashboard:', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack,
    })
    if (err?.code === 'P1001' || err?.message?.includes("Can't reach database server")) {
      console.error('🔴 Prisma P1001: Cannot reach database server')
      console.error('   DATABASE_URL host:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'NOT SET')
    }
    // Fallback: load dashboard stats via raw SQL when Prisma fails (e.g. missing columns).
    // Run each query in its own try/catch so one failure doesn't kill the whole fallback.
    const now = new Date()

    try {
      const totalRows = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM rbt_profiles`
      totalCandidates = Number(totalRows[0]?.count ?? 0)
    } catch (e) {
      console.error('Dashboard raw count failed', e)
      dashboardLoadError = true
    }

    try {
      const statusRows = await prisma.$queryRaw<Array<{ status: string; _count: bigint }>>`
        SELECT status, COUNT(*)::bigint as _count FROM rbt_profiles GROUP BY status
      `
      candidatesByStatus = statusRows.map((r) => ({ status: r.status, _count: Number(r._count) }))
    } catch (e) {
      console.error('Dashboard raw status groupBy failed', e)
    }

    try {
      const interviewRows = await prisma.$queryRaw<
        Array<{
          id: string
          scheduledAt: Date
          durationMinutes: number
          interviewerName: string
          status: string
          meetingUrl: string | null
          rbtProfileId: string
          firstName: string
          lastName: string
        }>
      >`
        SELECT i.id, i."scheduledAt", i."durationMinutes", i."interviewerName", i.status, i."meetingUrl", i."rbtProfileId",
               r."firstName", r."lastName"
        FROM interviews i
        JOIN rbt_profiles r ON r.id = i."rbtProfileId"
        WHERE i.status = 'SCHEDULED' AND i."scheduledAt" >= ${now}
        ORDER BY i."scheduledAt" ASC
        LIMIT 50
      `
      upcomingInterviews = interviewRows.map((row) => ({
        id: row.id,
        scheduledAt: row.scheduledAt,
        durationMinutes: row.durationMinutes,
        interviewerName: row.interviewerName,
        status: row.status,
        meetingUrl: row.meetingUrl,
        rbtProfileId: row.rbtProfileId,
        rbtProfile: { id: row.rbtProfileId, firstName: row.firstName, lastName: row.lastName },
      }))
    } catch (e) {
      console.error('Dashboard raw upcoming interviews failed', e)
    }

    try {
      const hireRows = await prisma.$queryRaw<
        Array<{ id: string; firstName: string; lastName: string; email: string | null; updatedAt: Date }>
      >`
        SELECT id, "firstName", "lastName", email, "updatedAt"
        FROM rbt_profiles
        WHERE status = 'HIRED'
        ORDER BY "updatedAt" DESC
        LIMIT 5
      `
      recentHires = hireRows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        updatedAt: row.updatedAt,
      }))
    } catch (e) {
      console.error('Dashboard raw recent hires failed', e)
    }

    try {
      const onboardingRows = await prisma.$queryRaw<Array<{ rbtProfileId: string }>>`
        SELECT "rbtProfileId" FROM onboarding_tasks WHERE "isCompleted" = false GROUP BY "rbtProfileId"
      `
      pendingOnboarding = onboardingRows.map((r) => ({ rbtProfileId: r.rbtProfileId, _count: { id: 1 } }))
    } catch (e) {
      console.error('Dashboard raw pending onboarding failed', e)
    }
  }

  const statusCounts = candidatesByStatus.reduce((acc, item) => {
    acc[item.status] = item._count
    return acc
  }, {} as Record<string, number>)

  const pendingOnboardingCount = pendingOnboarding.length

  return (
    <div className="space-y-8">
      {dashboardLoadError && (
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)] p-4 text-amber-900 dark:text-[var(--status-warning-text)]">
          <p className="font-semibold">Data could not be loaded</p>
          <p className="text-sm mt-1">Your data is still in the database. Run the migration in Supabase SQL Editor: open prisma/supabase-migrations.sql and run the whole file (or at least sections 4 and 5). Use the same Supabase project as your production DATABASE_URL. Then refresh.</p>
        </div>
      )}
      {/* Header with gradient banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-orange-50 text-lg">Welcome back! Here&apos;s an overview of your system.</p>
          </div>
          <TrackedLink href="/admin/rbts/new">
            <Button className="rounded-xl px-6 py-6 text-base font-semibold bg-white/90 text-orange-700 hover:bg-white border-0 shadow-md">
              <Plus className="w-5 h-5 mr-2" />
              Add New RBT / Candidate
            </Button>
          </TrackedLink>
        </div>
      </div>

      {/* Statistics Cards with colored borders and gradient icons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-hover border-2 border-gray-200 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-gray-50 dark:from-[var(--bg-elevated)] dark:to-[var(--bg-elevated)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Total Candidates</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)] mt-2">{totalCandidates}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1">All time</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 dark:border-green-800/40 bg-gradient-to-br from-white to-green-50 dark:from-[var(--bg-elevated)] dark:to-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Hired RBTs</p>
                <p className="text-3xl font-bold text-green-600 dark:text-[var(--status-hired-text)] mt-2">{statusCounts['HIRED'] || 0}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1">Active RBTs</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-blue-200 dark:border-blue-800/40 bg-gradient-to-br from-white to-blue-50 dark:from-[var(--bg-elevated)] dark:to-blue-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Upcoming Interviews</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-[var(--status-interview-text)] mt-2">{upcomingInterviews.length}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1">Next 5 interviews</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-purple-200 dark:border-purple-800/40 bg-gradient-to-br from-white to-purple-50 dark:from-[var(--bg-elevated)] dark:to-purple-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Pending Onboarding</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-[var(--status-onboarding-text)] mt-2">{pendingOnboardingCount}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1">Incomplete tasks</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidates by Status */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Candidates by Status</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">Distribution of candidates across the hiring pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 relative">
            {(
              [
                { status: 'NEW', color: 'text-gray-600', bg: 'bg-gray-100', darkNum: 'dark:text-[var(--text-primary)]', darkBg: 'dark:bg-[var(--bg-elevated)]' },
                { status: 'REACH_OUT', color: 'text-blue-600', bg: 'bg-blue-100', darkNum: 'dark:text-[var(--status-interview-text)]', darkBg: 'dark:bg-[var(--status-interview-bg)]' },
                { status: 'TO_INTERVIEW', color: 'text-yellow-600', bg: 'bg-yellow-100', darkNum: 'dark:text-[var(--status-warning-text)]', darkBg: 'dark:bg-[var(--status-warning-bg)]' },
                { status: 'INTERVIEW_SCHEDULED', color: 'text-purple-600', bg: 'bg-purple-100', darkNum: 'dark:text-[var(--status-onboarding-text)]', darkBg: 'dark:bg-[var(--status-onboarding-bg)]' },
                { status: 'INTERVIEW_COMPLETED', color: 'text-indigo-600', bg: 'bg-indigo-100', darkNum: 'dark:text-[var(--status-scheduled-text)]', darkBg: 'dark:bg-[var(--status-scheduled-bg)]' },
                { status: 'HIRED', color: 'text-green-600', bg: 'bg-green-100', darkNum: 'dark:text-[var(--status-hired-text)]', darkBg: 'dark:bg-[var(--status-hired-bg)]' },
                { status: 'REJECTED', color: 'text-red-600', bg: 'bg-red-100', darkNum: 'dark:text-[var(--status-rejected-text)]', darkBg: 'dark:bg-[var(--status-rejected-bg)]' },
              ] as const
            ).map(({ status, color, bg, darkNum, darkBg }) => {
              const count = statusCounts[status] || 0
              return (
                <div key={status} className={`text-center p-4 rounded-xl ${bg} ${darkBg} border-2 border-transparent dark:border-[var(--border-subtle)] transition-all`}>
                  <div className={`text-3xl font-bold ${color} ${darkNum} mb-1`}>
                    {count}
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-[var(--text-tertiary)] mt-1">
                    {status.replace(/_/g, ' ')}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Interviews */}
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-[var(--status-interview-text)]" />
              Upcoming Interviews
            </CardTitle>
            <CardDescription className="dark:text-[var(--text-tertiary)]">Next scheduled interviews</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingInterviews.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-[var(--text-tertiary)] font-medium">No upcoming interviews</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingInterviews.map((interview) => {
                  const start = new Date(interview.scheduledAt)
                  const end = new Date(start.getTime() + (interview.durationMinutes || 30) * 60 * 1000)
                  const startStr = start.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  const endStr = end.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
                  return (
                    <div
                      key={interview.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg bg-gray-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]"
                    >
                      <div>
                        <div className="font-bold text-gray-900 dark:text-[var(--text-primary)]">
                          {interview.rbtProfile.firstName} {interview.rbtProfile.lastName}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
                          {startStr} – {endStr} • {interview.interviewerName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {interview.meetingUrl && (
                          <a
                            href={interview.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-[var(--orange-primary)] dark:hover:text-[var(--orange-hover)]"
                          >
                            Join
                          </a>
                        )}
                        <Link href={`/admin/rbts/${interview.rbtProfile.id}`}>
                          <Button variant="outline" size="sm" className="rounded-lg dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">Profile</Button>
                        </Link>
                        <Badge className="border-0 bg-blue-100 text-blue-800 dark:bg-[var(--status-interview-bg)] dark:text-[var(--status-interview-text)]">{interview.status}</Badge>
                      </div>
                    </div>
                  )
                })}
                <Link href="/admin/interviews">
                  <Button variant="outline" className="w-full mt-4 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]">
                    View All Interviews
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Hired */}
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-[var(--status-hired-text)]" />
              Recently Hired RBTs
            </CardTitle>
            <CardDescription className="dark:text-[var(--text-tertiary)]">Latest additions to the team</CardDescription>
          </CardHeader>
          <CardContent>
            {recentHires.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-[var(--text-tertiary)] font-medium">No recently hired RBTs</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentHires.map((rbt) => (
                  <div
                    key={rbt.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg bg-gray-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div>
                      <div className="font-bold text-gray-900 dark:text-[var(--text-primary)]">
                        {rbt.firstName} {rbt.lastName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
                        {rbt.email} • Hired {formatDate(rbt.updatedAt)}
                      </div>
                    </div>
                    <Link href={`/admin/rbts/${rbt.id}`}>
                      <Button variant="outline" size="sm" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]">
                        View →
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
