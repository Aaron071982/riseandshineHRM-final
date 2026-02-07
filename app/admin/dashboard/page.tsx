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
    // Do not rethrow: render dashboard with empty stats so the page loads; user can try again
  }

  const statusCounts = candidatesByStatus.reduce((acc, item) => {
    acc[item.status] = item._count
    return acc
  }, {} as Record<string, number>)

  const pendingOnboardingCount = pendingOnboarding.length

  return (
    <div className="space-y-8">
      {/* Header with gradient background */}
      <div className="dashboard-banner relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 dark:bg-[var(--orange-subtle)] rounded-full -mr-16 -mt-16 bubble-animation dark:opacity-30" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 dark:bg-[var(--orange-subtle)] rounded-full -ml-12 -mb-12 bubble-animation-delayed dark:opacity-20" />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/15 dark:bg-[var(--orange-subtle)] rounded-full bubble-animation-delayed-2 dark:opacity-10" />
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white dark:text-[var(--text-primary)] mb-2">Admin Dashboard</h1>
            <p className="text-orange-50 dark:text-[var(--text-tertiary)] text-lg">Welcome back! Here&apos;s an overview of your system.</p>
          </div>
          <TrackedLink href="/admin/rbts/new">
            <Button className="bg-white text-primary hover:bg-orange-50 dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)] dark:hover:bg-[var(--orange-hover)] border-0 shadow-lg rounded-xl px-6 py-6 text-base font-semibold shine-effect">
              <Plus className="w-5 h-5 mr-2" />
              Add New RBT / Candidate
            </Button>
          </TrackedLink>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-hover border-2 border-orange-200 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-orange-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Total Candidates</p>
                <p className="text-3xl font-bold text-gradient mt-2 dark:text-[var(--text-primary)]">{totalCandidates}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1">All time</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-primary dark:bg-[var(--orange-subtle)] flex items-center justify-center glow-effect">
                <Users className="h-6 w-6 text-white dark:text-[var(--orange-primary)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-green-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Hired RBTs</p>
                <p className="text-3xl font-bold text-green-600 dark:text-[var(--status-hired-text)] mt-2">{statusCounts['HIRED'] || 0}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1">Active RBTs</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green dark:bg-[var(--status-hired-bg)] flex items-center justify-center glow-effect">
                <CheckCircle className="h-6 w-6 text-white dark:text-[var(--status-hired-text)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-blue-200 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-blue-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Upcoming Interviews</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-[var(--status-interview-text)] mt-2">{upcomingInterviews.length}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1">Next 5 interviews</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue dark:bg-[var(--status-interview-bg)] flex items-center justify-center glow-effect">
                <Calendar className="h-6 w-6 text-white dark:text-[var(--status-interview-text)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-purple-200 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-purple-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Pending Onboarding</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-[var(--status-onboarding-text)] mt-2">{pendingOnboardingCount}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1">Incomplete tasks</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple dark:bg-[var(--status-onboarding-bg)] flex items-center justify-center glow-effect">
                <FileCheck className="h-6 w-6 text-white dark:text-[var(--status-onboarding-text)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidates by Status */}
      <Card className="border-2 border-orange-100 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-orange-50/30 dark:bg-[var(--bg-elevated)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200/20 dark:bg-[var(--orange-subtle)] rounded-full -mr-20 -mt-20 bubble-animation dark:opacity-20" />
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
        <Card className="border-2 border-blue-100 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-blue-50/30 dark:bg-[var(--bg-elevated)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 dark:bg-[var(--status-interview-bg)] rounded-full -mr-16 -mt-16 bubble-animation-delayed dark:opacity-30" />
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
                      className="flex items-center justify-between p-4 border-2 border-blue-200 dark:border-[var(--border-subtle)] rounded-xl bg-white dark:bg-[var(--bg-primary)] hover:shadow-md dark:hover:bg-[var(--bg-elevated-hover)] transition-all card-hover"
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
                        <Badge className="gradient-blue text-white border-0 dark:bg-[var(--status-interview-bg)] dark:text-[var(--status-interview-text)]">{interview.status}</Badge>
                      </div>
                    </div>
                  )
                })}
                <Link href="/admin/interviews">
                  <Button variant="outline" className="w-full mt-4 border-2 border-blue-200 hover:bg-blue-50 dark:border-[var(--border-subtle)] dark:hover:bg-[var(--bg-elevated-hover)] rounded-xl">
                    View All Interviews
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Hired */}
        <Card className="border-2 border-green-100 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-green-50/30 dark:bg-[var(--bg-elevated)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 dark:bg-[var(--status-hired-bg)] rounded-full -mr-16 -mt-16 bubble-animation-delayed-2 dark:opacity-30" />
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
                    className="flex items-center justify-between p-4 border-2 border-green-200 dark:border-[var(--border-subtle)] rounded-xl bg-white dark:bg-[var(--bg-primary)] hover:shadow-md dark:hover:bg-[var(--bg-elevated-hover)] transition-all card-hover"
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
                      <Button className="gradient-green text-white border-0 rounded-lg px-4 shine-effect dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)] dark:hover:bg-[var(--status-hired-hover)]">
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
