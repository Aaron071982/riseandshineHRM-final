import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Clock, Calendar, TrendingUp, User } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { AttendanceFilters } from './AttendanceFilters'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULT_RANGE = '30d' as const
const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
] as const

function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  let start: Date
  switch (range) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      break
    case '7d':
      start = new Date(now)
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      break
    case '30d':
    default:
      start = new Date(now)
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      break
  }
  return { start, end }
}

type TimeEntryWithRelations = Prisma.TimeEntryGetPayload<{
  include: { rbtProfile: true; shift: true; sessionNote: true }
}>

function AttendanceError() {
  return (
    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)] p-6 text-center">
      <p className="font-semibold text-amber-900 dark:text-[var(--status-warning-text)]">Could not load attendance data</p>
      <p className="text-sm text-amber-700 dark:text-[var(--status-warning-text)] mt-2">The database may be temporarily unavailable. Try refreshing the page.</p>
    </div>
  )
}

function signatureLabel(status: TimeEntryWithRelations['signatureStatus']): string {
  if (!status) return '—'
  switch (status) {
    case 'SIGNED':
      return 'Signed'
    case 'MISSING':
      return 'Missing'
    case 'NA':
      return 'N/A'
    default:
      return '—'
  }
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; rbtProfileId?: string }>
}) {
  const params = await searchParams
  const rangeParam = (params.range && RANGE_OPTIONS.some(r => r.value === params.range)) ? params.range : DEFAULT_RANGE
  const rbtProfileIdFilter = params.rbtProfileId && params.rbtProfileId.trim() ? params.rbtProfileId.trim() : null
  const { start, end } = getDateRange(rangeParam)

  const whereClause = {
    clockInTime: { gte: start, lte: end },
    clockOutTime: { not: null },
    ...(rbtProfileIdFilter ? { rbtProfileId: rbtProfileIdFilter } : {}),
  }

  let timeEntries: TimeEntryWithRelations[]
  let stats: { totalHours: number; timeEntriesCount: number; activeRBTsCount: number; todayCount: number }
  let hiredRBTs: { id: string; firstName: string; lastName: string }[] = []

  try {
    const [entries, agg, todayCountResult, hiredList] = await Promise.all([
      prisma.timeEntry.findMany({
        where: whereClause,
        include: {
          rbtProfile: true,
          shift: true,
          sessionNote: true,
        },
        orderBy: { clockInTime: 'desc' },
        take: 100,
      }),
      prisma.timeEntry.aggregate({
        where: whereClause,
        _sum: { totalHours: true },
        _count: { id: true },
      }),
      prisma.timeEntry.count({
        where: {
          clockOutTime: { not: null },
          ...(rbtProfileIdFilter ? { rbtProfileId: rbtProfileIdFilter } : {}),
          clockInTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(),
          },
        },
      }),
      prisma.rBTProfile.findMany({
        where: { status: 'HIRED' },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
    ])

    timeEntries = entries
    const distinctRBTs = await prisma.timeEntry.findMany({
      where: whereClause,
      select: { rbtProfileId: true },
      distinct: ['rbtProfileId'],
    })
    stats = {
      totalHours: agg._sum.totalHours ?? 0,
      timeEntriesCount: agg._count.id,
      activeRBTsCount: distinctRBTs.length,
      todayCount: todayCountResult,
    }
    hiredRBTs = hiredList
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

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-500 via-green-400 to-emerald-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Attendance & Hours</h1>
          <p className="text-green-50 text-lg">View time entries and hours worked</p>
        </div>
      </div>

      <Suspense fallback={<div className="h-20 rounded-xl border-2 border-gray-200 dark:border-[var(--border-subtle)] animate-pulse bg-gray-100 dark:bg-[var(--bg-elevated)]" />}>
        <AttendanceFilters
          rangeParam={rangeParam}
          rbtProfileIdFilter={rbtProfileIdFilter}
          hiredRBTs={hiredRBTs}
          rangeOptions={RANGE_OPTIONS}
        />
      </Suspense>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-hover border-2 border-green-200 dark:border-green-800/40 bg-gradient-to-br from-white to-green-50 dark:from-[var(--bg-elevated)] dark:to-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Total Hours</p>
                <p className="text-3xl font-bold text-green-600 dark:text-[var(--status-hired-text)] mt-2">{stats.totalHours.toFixed(1)}h</p>
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
                <p className="text-3xl font-bold text-blue-600 dark:text-[var(--status-interview-text)] mt-2">{stats.timeEntriesCount}</p>
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
                <p className="text-3xl font-bold text-purple-600 dark:text-[var(--status-onboarding-text)] mt-2">{stats.activeRBTsCount}</p>
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
                <p className="text-3xl font-bold text-orange-600 dark:text-[var(--orange-primary)] mt-2">{stats.todayCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries List */}
      <Card className="border-2 border-green-100 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-green-50/30 dark:from-[var(--bg-elevated)] dark:to-[var(--bg-elevated)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-green-200/20 dark:bg-green-500/10 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">No time entries found</p>
              <p className="text-gray-500 dark:text-[var(--text-tertiary)]">
                {rbtProfileIdFilter ? 'No entries for this RBT in the selected period.' : 'RBTs will appear here once they log their hours.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => (
                <TimeEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TimeEntryRow({ entry }: { entry: TimeEntryWithRelations }) {
  const hasNotes = !!entry.sessionNote
  const signature = signatureLabel(entry.signatureStatus)

  return (
    <div className="border-2 border-gray-200 dark:border-[var(--border-subtle)] rounded-xl p-5 bg-white dark:bg-[var(--bg-elevated)] hover:shadow-lg dark:hover:bg-[var(--bg-elevated-hover)] transition-all card-hover relative overflow-hidden">
      <div className="absolute top-0 right-0 w-20 h-20 bg-green-100/30 dark:bg-green-500/10 rounded-full -mr-10 -mt-10" />
      <div className="relative grid grid-cols-1 md:grid-cols-8 gap-4 items-center">
        <div className="md:col-span-2">
          <h3 className="font-bold text-lg text-gray-900 dark:text-[var(--text-primary)] mb-1">
            <Link
              href={`/admin/attendance/rbt/${encodeURIComponent(entry.rbtProfileId)}`}
              className="text-green-700 dark:text-[var(--status-hired-text)] hover:underline"
            >
              {entry.rbtProfile.firstName} {entry.rbtProfile.lastName}
            </Link>
          </h3>
          <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">{formatDate(entry.clockInTime)}</div>
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
          <div className="font-medium mb-1 dark:text-[var(--text-secondary)]">Signature</div>
          <div className="text-xs">{signature}</div>
        </div>
        <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
          <div className="font-medium mb-1 dark:text-[var(--text-secondary)]">Source</div>
          <div className="text-xs">{entry.source.replace(/_/g, ' ')}</div>
          {entry.shift && <div className="text-xs mt-1">{entry.shift.clientName}</div>}
        </div>
        <div className="text-sm">
          <div className="font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-1">Session Notes</div>
          {hasNotes ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-green-600 dark:text-[var(--status-hired-text)] hover:underline">View notes</summary>
              <div className="mt-2 p-2 rounded bg-gray-50 dark:bg-[var(--bg-elevated)] border border-gray-200 dark:border-[var(--border-subtle)] space-y-1">
                {entry.sessionNote!.summary && <p><span className="font-medium">Summary:</span> {entry.sessionNote!.summary}</p>}
                {entry.sessionNote!.whereServicesWere && <p><span className="font-medium">Where:</span> {entry.sessionNote!.whereServicesWere}</p>}
                {entry.sessionNote!.goalsWorkedOn && <p><span className="font-medium">Goals:</span> {entry.sessionNote!.goalsWorkedOn}</p>}
                {entry.sessionNote!.generalComments && <p><span className="font-medium">Comments:</span> {entry.sessionNote!.generalComments}</p>}
              </div>
            </details>
          ) : (
            <span className="text-gray-500 dark:text-[var(--text-tertiary)]">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
