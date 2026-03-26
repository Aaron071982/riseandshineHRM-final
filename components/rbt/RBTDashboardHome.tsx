import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Calendar, Clock, CheckCircle2, Circle, ClipboardList } from 'lucide-react'

function getTimeBasedGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getMotivationalMessage(percent: number): string {
  if (percent >= 100) return "You're all set! Welcome to the team."
  if (percent >= 76) return "Almost there — just a few more steps."
  if (percent >= 51) return "You're over halfway. Keep going!"
  if (percent >= 26) return "Good progress. You've got this."
  return "Let's get started. Complete your onboarding to unlock your schedule."
}

type Shift = {
  id: string
  clientName: string
  startTime: Date
  endTime: Date
  locationAddress: string | null
  status: string
}

type TaskItem = {
  id: string
  title: string
  isCompleted: boolean
}

interface RBTDashboardHomeProps {
  firstName: string
  onboardingPercent: number
  totalSteps: number
  completedSteps: number
  remainingTasks: TaskItem[]
  completedTasks: TaskItem[]
  todayShifts: Shift[]
  upcomingShifts: Shift[]
  hoursThisWeek: number
  hoursThisMonth: number
  upcomingShiftsCount: number
  /** Fillable PDFs that were downloaded but not yet uploaded (for reminder banner) */
  pendingUploadTitles?: string[]
  activeSessionClockIn?: Date | null
}

export default function RBTDashboardHome({
  firstName,
  onboardingPercent,
  totalSteps,
  completedSteps,
  remainingTasks,
  completedTasks,
  todayShifts,
  upcomingShifts,
  hoursThisWeek,
  hoursThisMonth,
  upcomingShiftsCount,
  pendingUploadTitles = [],
  activeSessionClockIn = null,
}: RBTDashboardHomeProps) {
  const greeting = getTimeBasedGreeting()
  const showOnboarding = onboardingPercent < 100
  const showUploadReminder = pendingUploadTitles.length > 0
  const statusColors: Record<string, string> = {
    SCHEDULED: 'bg-blue-500',
    COMPLETED: 'bg-green-500',
    CANCELED: 'bg-gray-500',
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
        {greeting}, {firstName}!
      </h1>

      {/* Fillable PDF upload reminder: downloaded but not yet uploaded */}
      {showUploadReminder && (
        <div className="rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/40 dark:border-blue-500/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-blue-900 dark:text-blue-100 font-medium">
            You have fillable form{pendingUploadTitles.length > 1 ? 's' : ''} ready to upload: {pendingUploadTitles.join(', ')}. Complete and upload from My Tasks.
          </p>
          <Button asChild size="sm" variant="outline" className="border-blue-600 text-blue-800 dark:text-blue-200 shrink-0">
            <Link href="/rbt/tasks">Go to My Tasks</Link>
          </Button>
        </div>
      )}

      {/* Onboarding banner (when < 100%) */}
      {showOnboarding && (
        <div className="rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/40 dark:border-amber-500/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            Your onboarding is {Math.round(onboardingPercent)}% complete — finish to get started!
          </p>
          <Button asChild size="sm" className="bg-[#e36f1e] hover:bg-[#c95e18] text-white shrink-0">
            <Link href="/rbt/tasks">Continue Onboarding</Link>
          </Button>
        </div>
      )}

      {/* Onboarding progress card (when < 100%) */}
      {showOnboarding && (
        <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#e36f1e]" />
              Onboarding progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-200 dark:text-gray-700"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#e36f1e] dark:text-[var(--orange-primary)]"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${onboardingPercent}, 100`}
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-[var(--text-secondary)]">
                    {Math.round(onboardingPercent)}%
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                    {completedSteps} of {totalSteps} tasks completed
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
                    {getMotivationalMessage(onboardingPercent)}
                  </p>
                </div>
              </div>
              {remainingTasks.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-2">Remaining</p>
                  <ul className="space-y-1">
                    {remainingTasks.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/rbt/tasks#step-${t.id}`}
                          className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-[var(--text-secondary)] hover:text-[#e36f1e] dark:hover:text-[var(--orange-primary)]"
                        >
                          <Circle className="w-4 h-4 shrink-0 text-gray-400" />
                          {t.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {completedTasks.length > 0 && (
                <details className="group">
                  <summary className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)] cursor-pointer list-none flex items-center gap-2">
                    <span className="group-open:inline hidden">▼</span>
                    <span className="group-open:hidden inline">▶</span>
                    Completed ({completedTasks.length})
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {completedTasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-sm text-gray-500 dark:text-[var(--text-tertiary)] line-through">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                        {t.title}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <Button asChild variant="outline" size="sm" className="border-[#e36f1e] text-[#e36f1e] hover:bg-[#e36f1e]/10">
                <Link href="/rbt/tasks">Go to My Tasks</Link>
              </Button>
            </CardContent>
        </Card>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours this week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hoursThisWeek.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours this month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hoursThisMonth.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming shifts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingShiftsCount}</div>
          </CardContent>
        </Card>
        <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Session</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {activeSessionClockIn ? (
              <Link href="/rbt/sessions" className="inline-flex items-center gap-2 text-green-700 dark:text-green-300">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="font-semibold">
                  Session Active — {((Date.now() - new Date(activeSessionClockIn).getTime()) / 3600000).toFixed(1)}h
                </span>
              </Link>
            ) : (
              <Link href="/rbt/sessions" className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] hover:underline">
                No active session
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's schedule */}
      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="dark:text-[var(--text-primary)]">Today&apos;s schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {todayShifts.length === 0 ? (
            <p className="text-gray-500 dark:text-[var(--text-tertiary)] text-center py-4">No shifts scheduled for today</p>
          ) : (
            <div className="space-y-3">
              {todayShifts.map((shift) => (
                <div key={shift.id} className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-primary)]">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium dark:text-[var(--text-primary)]">{shift.clientName}</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {formatDateTime(shift.startTime)} – {formatDateTime(shift.endTime)}
                      </p>
                      {shift.locationAddress && (
                        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{shift.locationAddress}</p>
                      )}
                    </div>
                    <Badge className={`${statusColors[shift.status] || 'bg-gray-500'} text-white`}>
                      {shift.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming shifts (next 3) */}
      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="dark:text-[var(--text-primary)]">Upcoming shifts</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingShifts.length === 0 ? (
            <p className="text-gray-500 dark:text-[var(--text-tertiary)] text-center py-4">No upcoming shifts</p>
          ) : (
            <div className="space-y-3">
              {upcomingShifts.slice(0, 3).map((shift) => (
                <div key={shift.id} className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-primary)]">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium dark:text-[var(--text-primary)]">{shift.clientName}</p>
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {formatDate(shift.startTime)} • {new Date(shift.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        – {new Date(shift.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {shift.locationAddress && (
                        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">{shift.locationAddress}</p>
                      )}
                    </div>
                    <Badge className={`${statusColors[shift.status] || 'bg-gray-500'} text-white`}>
                      {shift.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {upcomingShiftsCount > 0 && (
            <div className="mt-4">
              <Button asChild variant="outline" className="w-full dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">
                <Link href="/rbt/schedule">View full schedule</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
