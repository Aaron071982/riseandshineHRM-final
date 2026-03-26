import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, cn } from '@/lib/utils'
import { Calendar, Clock, User, Video, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import InterviewNotesButton from '@/components/admin/InterviewNotesButton'
import InterviewDeleteButton from '@/components/admin/InterviewDeleteButton'
import InterviewCompleteButton from '@/components/admin/InterviewCompleteButton'
import InterviewClaimButton from '@/components/admin/InterviewClaimButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams?: {
    view?: string
    weekOffset?: string
    interviewerId?: string
  }
}) {
  const view = searchParams?.view === 'calendar' ? 'calendar' : 'list'
  const weekOffset = Number.parseInt(searchParams?.weekOffset ?? '0', 10) || 0
  const interviewerId = searchParams?.interviewerId ?? 'all'

  let interviews: Array<{
    id: string
    scheduledAt: Date
    durationMinutes: number
    interviewerName: string
    status: string
    decision: string
    meetingUrl: string | null
    rbtProfileId: string
    claimedByUserId: string | null
    rbtProfile: { id: string; firstName: string; lastName: string }
    claimedBy: { id: string; name: string | null; email: string | null } | null
    scorecards: Array<{ scores: unknown }>
  }> = []

  try {
    const raw = await prisma.interview.findMany({
      include: {
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
        claimedBy: { select: { id: true, name: true, email: true } },
        scorecards: { select: { scores: true }, take: 1 },
      },
      orderBy: { scheduledAt: 'desc' },
    })
    interviews = raw as typeof interviews
  } catch {
    try {
      const raw = await prisma.interview.findMany({
        include: {
          rbtProfile: { select: { id: true, firstName: true, lastName: true } },
          scorecards: { select: { scores: true }, take: 1 },
        },
        orderBy: { scheduledAt: 'desc' },
      })
      interviews = raw.map((r) => ({ ...r, claimedByUserId: null as string | null, claimedBy: null as { id: string; name: string | null; email: string | null } | null })) as typeof interviews
    } catch (error) {
      console.error('Admin interviews: failed to load', error)
    }
  }

  const statusColors: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    NO_SHOW: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    CANCELED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)

  const todayInterviews = interviews.filter(
    (i) => i.status === 'SCHEDULED' && new Date(i.scheduledAt) >= todayStart && new Date(i.scheduledAt) < todayEnd
  )
  const unclaimedToday = todayInterviews.filter((i) => !i.claimedByUserId)
  const upcomingInterviews = interviews.filter(
    (i) => i.status === 'SCHEDULED' && new Date(i.scheduledAt) >= todayEnd
  )
  const pastInterviews = interviews.filter(
    (i) => i.status !== 'SCHEDULED' || new Date(i.scheduledAt) < todayStart
  )

  const thisWeekStart = new Date(todayStart)
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay())
  const thisWeekEnd = new Date(thisWeekStart.getTime() + 7 * 86400000)
  const thisWeekCount = interviews.filter(
    (i) => new Date(i.scheduledAt) >= thisWeekStart && new Date(i.scheduledAt) < thisWeekEnd
  ).length

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const scorecardInterviews = interviews.filter(
    (i) => new Date(i.scheduledAt) >= thisMonthStart && i.scorecards.length > 0
  )
  let avgScore = 0
  if (scorecardInterviews.length > 0) {
    let totalScore = 0
    let totalCount = 0
    for (const si of scorecardInterviews) {
      const scores = si.scorecards[0]?.scores as Record<string, number> | null
      if (scores) {
        const vals = Object.values(scores).filter((v) => typeof v === 'number' && v >= 1 && v <= 5)
        if (vals.length > 0) {
          totalScore += vals.reduce((a, b) => a + b, 0) / vals.length
          totalCount++
        }
      }
    }
    if (totalCount > 0) avgScore = Math.round((totalScore / totalCount) * 10) / 10
  }

  if (view === 'calendar') {
    const calendarWeekStart = new Date(todayStart)
    calendarWeekStart.setDate(calendarWeekStart.getDate() - calendarWeekStart.getDay() + weekOffset * 7)
    const calendarWeekEnd = new Date(calendarWeekStart.getTime() + 7 * 86400000)

    const weeklyInterviews = interviews
      .filter(
        (i) =>
          i.status === 'SCHEDULED' &&
          new Date(i.scheduledAt) >= calendarWeekStart &&
          new Date(i.scheduledAt) < calendarWeekEnd
      )
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

    const interviewerKey = (i: (typeof interviews)[0]) => i.claimedByUserId ?? i.interviewerName

    const weeklyFiltered =
      interviewerId === 'all'
        ? weeklyInterviews
        : weeklyInterviews.filter((i) => interviewerKey(i) === interviewerId)

    const uniqueInterviewerKeys = Array.from(new Set(weeklyInterviews.map((i) => interviewerKey(i))))

    const palette = [
      'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200',
      'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
      'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:text-green-200',
      'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200',
      'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:text-rose-200',
      'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200',
    ]

    const keyToColor = new Map<string, string>()
    uniqueInterviewerKeys.forEach((key, idx) => {
      keyToColor.set(key, palette[idx % palette.length])
    })

    const weekDays = Array.from({ length: 7 }, (_, idx) => new Date(calendarWeekStart.getTime() + idx * 86400000))

    const weekTitle = calendarWeekStart.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
    })

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 via-purple-400 to-violet-400 p-8 shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12" />
              <div className="relative">
                <h1 className="text-4xl font-bold text-white mb-2">Interviews</h1>
                <p className="text-purple-50 text-lg">Calendar for week of {weekTitle}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-[160px]">
            <Link href="/admin/interviews" className="w-full">
              <Button variant="outline" className="w-full">List</Button>
            </Link>
            <Button disabled className="w-full bg-orange-600 hover:bg-orange-700 text-white">Calendar</Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex gap-2">
            <Link href={`/admin/interviews?view=calendar&weekOffset=0${interviewerId !== 'all' ? `&interviewerId=${encodeURIComponent(interviewerId)}` : ''}`}>
              <Button variant={weekOffset === 0 ? 'default' : 'outline'} className={weekOffset === 0 ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}>
                This Week
              </Button>
            </Link>
            <Link href={`/admin/interviews?view=calendar&weekOffset=1${interviewerId !== 'all' ? `&interviewerId=${encodeURIComponent(interviewerId)}` : ''}`}>
              <Button variant={weekOffset === 1 ? 'default' : 'outline'} className={weekOffset === 1 ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}>
                Next Week
              </Button>
            </Link>
          </div>

          <form method="get" action="/admin/interviews" className="flex items-center gap-3">
            <input type="hidden" name="view" value="calendar" />
            <input type="hidden" name="weekOffset" value={weekOffset} />
            <label className="text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)]">Filter</label>
            <select
              name="interviewerId"
              defaultValue={interviewerId}
              className="rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm"
            >
              <option value="all">All interviewers</option>
              {uniqueInterviewerKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white">Apply</Button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dayStart = new Date(day.getTime())
            dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(dayStart.getTime() + 86400000)

            const dayInterviews = weeklyFiltered
              .filter((i) => new Date(i.scheduledAt) >= dayStart && new Date(i.scheduledAt) < dayEnd)
              .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

            const dayLabel = day.toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              weekday: 'short',
            })

            return (
              <div key={day.toISOString()} className="border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg bg-white dark:bg-[var(--bg-elevated)] p-3">
                <div className="font-semibold text-gray-900 dark:text-white mb-2">{dayLabel}</div>
                {dayInterviews.length === 0 ? (
                  <div className="text-sm text-gray-500">—</div>
                ) : (
                  <div className="space-y-2">
                    {dayInterviews.map((i) => {
                      const key = interviewerKey(i)
                      const color = keyToColor.get(key) ?? palette[0]
                      const startTime = new Date(i.scheduledAt).toLocaleTimeString('en-US', {
                        timeZone: 'America/New_York',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                      return (
                        <Link
                          key={i.id}
                          href={`/admin/interviews/${i.id}/notes`}
                          className={cn('block rounded-lg border p-3 hover:shadow-sm transition', color)}
                        >
                          <div className="text-sm font-semibold">
                            {i.rbtProfile.firstName} {i.rbtProfile.lastName}
                          </div>
                          <div className="text-xs opacity-90 mt-1">{startTime}</div>
                          <div className="text-xs opacity-90 mt-1">{i.interviewerName}</div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderRow = (interview: (typeof interviews)[0], showClaim = true) => {
    const endAt = new Date(new Date(interview.scheduledAt).getTime() + (interview.durationMinutes || 30) * 60000)
    const claimed = !!interview.claimedByUserId
    const claimerName = interview.claimedBy?.name || interview.claimedBy?.email || null

    return (
      <div key={interview.id} className="border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg p-4 bg-white dark:bg-[var(--bg-elevated)] hover:shadow-sm transition-shadow">
        <div className="flex flex-wrap items-center gap-4">
          {/* Claim dot */}
          {showClaim && interview.status === 'SCHEDULED' && (
            <div className={`w-3 h-3 rounded-full shrink-0 ${claimed ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
          )}

          {/* Name + time */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="font-semibold text-gray-900 dark:text-white">
                {interview.rbtProfile.firstName} {interview.rbtProfile.lastName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 ml-6">
              <Calendar className="h-3 w-3" />
              <span>{formatDateTime(new Date(interview.scheduledAt))} – {formatDateTime(endAt).split(', ')[1]}</span>
            </div>
          </div>

          {/* Interviewer / claimer */}
          <div className="text-sm text-gray-600 dark:text-gray-400 min-w-[140px]">
            {claimed ? (
              <span className="text-green-600 dark:text-green-400 font-medium">Claimed by {claimerName}</span>
            ) : interview.status === 'SCHEDULED' ? (
              <span className="text-orange-600 dark:text-orange-400 font-medium">Unclaimed</span>
            ) : (
              <span>{interview.interviewerName}</span>
            )}
          </div>

          {/* Status */}
          <Badge className={`${statusColors[interview.status] || statusColors.CANCELED} border-0 font-medium text-xs`}>
            {interview.status}
          </Badge>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {showClaim && interview.status === 'SCHEDULED' && !claimed && (
              <InterviewClaimButton interviewId={interview.id} />
            )}
            {interview.meetingUrl && (
              <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30">
                <Video className="w-3 h-3" /> Join
              </a>
            )}
            <InterviewNotesButton interviewId={interview.id} rbtProfileId={interview.rbtProfile.id} />
            {interview.status === 'SCHEDULED' && new Date(interview.scheduledAt) < now && (
              <InterviewCompleteButton interviewId={interview.id} />
            )}
            <InterviewDeleteButton interviewId={interview.id} rbtName={`${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}`} scheduledAt={new Date(interview.scheduledAt)} />
            <Link href={`/admin/rbts/${interview.rbtProfile.id}`}>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">Profile</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
          Manage interviews, claims, and scheduling
        </div>
        <div className="flex gap-2">
          <Link href="/admin/interviews">
            <Button variant="outline" className={view === 'list' ? 'border-orange-300 text-orange-700' : ''}>
              List
            </Button>
          </Link>
          <Link href={`/admin/interviews?view=calendar&weekOffset=0`}>
            <Button variant="outline">
              Calendar
            </Button>
          </Link>
        </div>
      </div>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 via-purple-400 to-violet-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Interviews</h1>
          <p className="text-purple-50 text-lg">Manage all interviews, claims, and scheduling</p>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border dark:border-[var(--border-subtle)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayInterviews.length}</p>
              <p className="text-xs text-gray-500">Today{unclaimedToday.length > 0 ? ` (${unclaimedToday.length} unclaimed)` : ''}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border dark:border-[var(--border-subtle)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{thisWeekCount}</p>
              <p className="text-xs text-gray-500">This week</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border dark:border-[var(--border-subtle)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{interviews.filter((i) => i.status === 'COMPLETED').length}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border dark:border-[var(--border-subtle)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgScore > 0 ? avgScore.toFixed(1) : '—'}</p>
              <p className="text-xs text-gray-500">Avg score (month)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unclaimed warning banner */}
      {unclaimedToday.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {unclaimedToday.length} unclaimed interview{unclaimedToday.length > 1 ? 's' : ''} today — someone needs to attend!
            </p>
          </div>
        </div>
      )}

      {/* ─── Today section ─────────────────────────────────────────── */}
      {todayInterviews.length > 0 && (
        <Card className="border-2 border-orange-200 dark:border-orange-800/40 bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {unclaimedToday.length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                Today&apos;s Interviews ({todayInterviews.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayInterviews.map((i) => renderRow(i, true))}
          </CardContent>
        </Card>
      )}

      {/* ─── Upcoming section ──────────────────────────────────────── */}
      {upcomingInterviews.length > 0 && (
        <Card className="border dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
              Upcoming ({upcomingInterviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingInterviews.map((i) => renderRow(i, true))}
          </CardContent>
        </Card>
      )}

      {/* ─── Past section ──────────────────────────────────────────── */}
      {pastInterviews.length > 0 && (
        <Card className="border dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
              Past ({pastInterviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pastInterviews.map((i) => renderRow(i, false))}
          </CardContent>
        </Card>
      )}

      {interviews.length === 0 && (
        <Card className="border dark:border-[var(--border-subtle)]">
          <CardContent className="py-12 text-center">
            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No interviews scheduled</p>
            <p className="text-gray-500">Start scheduling interviews from candidate profiles</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
