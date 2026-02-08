import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Clock, Calendar, TrendingUp, User } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type TimeEntryWithRelations = Prisma.TimeEntryGetPayload<{
  include: { rbtProfile: true; shift: true }
}>

function AttendanceError() {
  return (
    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)] p-6 text-center">
      <p className="font-semibold text-amber-900 dark:text-[var(--status-warning-text)]">Could not load attendance data</p>
      <p className="text-sm text-amber-700 dark:text-[var(--status-warning-text)] mt-2">The database may be temporarily unavailable. Try refreshing the page.</p>
    </div>
  )
}

export default async function AttendancePage() {
  let timeEntries: TimeEntryWithRelations[]
  try {
    timeEntries = await prisma.timeEntry.findMany({
      include: {
        rbtProfile: true,
        shift: true,
      },
      orderBy: {
        clockInTime: 'desc',
      },
      take: 50,
    })
  } catch (error) {
    console.error('Admin attendance: failed to load', error)
    return (
      <div className="space-y-6">
        <div className="pb-6 border-b dark:border-[var(--border-subtle)]">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Attendance & Hours</h1>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)]">View time entries and hours worked</p>
        </div>
        <AttendanceError />
      </div>
    )
  }

  // Calculate statistics
  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0)
  const uniqueRBTs = new Set(timeEntries.map(e => e.rbtProfileId)).size
  const todayEntries = timeEntries.filter(e => {
    const entryDate = new Date(e.clockInTime).toDateString()
    const today = new Date().toDateString()
    return entryDate === today
  })

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-500 via-green-400 to-emerald-400 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Attendance & Hours</h1>
          <p className="text-green-50 text-lg">View time entries and hours worked</p>
        </div>
      </div>

      {/* Stats Cards - new format with dark mode */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-hover border-2 border-green-200 dark:border-green-800/40 bg-gradient-to-br from-white to-green-50 dark:from-[var(--bg-elevated)] dark:to-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Total Hours</p>
                <p className="text-3xl font-bold text-green-600 dark:text-[var(--status-hired-text)] mt-2">{totalHours.toFixed(1)}h</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-blue-200 dark:border-blue-800/40 bg-gradient-to-br from-white to-blue-50 dark:from-[var(--bg-elevated)] dark:to-blue-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Time Entries</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-[var(--status-interview-text)] mt-2">{timeEntries.length}</p>
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
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Active RBTs</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-[var(--status-onboarding-text)] mt-2">{uniqueRBTs}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-orange-200 dark:border-orange-800/40 bg-gradient-to-br from-white to-orange-50 dark:from-[var(--bg-elevated)] dark:to-orange-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Today&apos;s Entries</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-[var(--orange-primary)] mt-2">{todayEntries.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries List - new format with dark mode */}
      <Card className="border-2 border-green-100 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-green-50/30 dark:from-[var(--bg-elevated)] dark:to-[var(--bg-elevated)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-green-200/20 dark:bg-green-500/10 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">No time entries found</p>
              <p className="text-gray-500 dark:text-[var(--text-tertiary)]">RBTs will appear here once they log their hours</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-2 border-gray-200 dark:border-[var(--border-subtle)] rounded-xl p-5 bg-white dark:bg-[var(--bg-elevated)] hover:shadow-lg dark:hover:bg-[var(--bg-elevated-hover)] transition-all card-hover relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-green-100/30 dark:bg-green-500/10 rounded-full -mr-10 -mt-10" />
                  <div className="relative grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    <div className="md:col-span-2">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-[var(--text-primary)] mb-1">
                        {entry.rbtProfile.firstName} {entry.rbtProfile.lastName}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                        {formatDate(entry.clockInTime)}
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-1">Clock In</div>
                      <div className="text-gray-600 dark:text-[var(--text-tertiary)]">{formatDateTime(entry.clockInTime)}</div>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-1">Clock Out</div>
                      <div className="text-gray-600 dark:text-[var(--text-tertiary)]">
                        {entry.clockOutTime ? formatDateTime(entry.clockOutTime) : <span className="text-orange-600 dark:text-[var(--orange-primary)]">In Progress</span>}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600 dark:text-[var(--status-hired-text)]">
                        {entry.totalHours ? `${entry.totalHours.toFixed(2)}h` : '—'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">Total Hours</div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                      <div className="font-medium mb-1 dark:text-[var(--text-secondary)]">Source</div>
                      <div className="text-xs">{entry.source.replace(/_/g, ' ')}</div>
                      {entry.shift && (
                        <div className="text-xs mt-1">{entry.shift.clientName}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
