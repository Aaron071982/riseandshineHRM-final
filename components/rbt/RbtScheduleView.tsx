'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, MapPin, Loader2 } from 'lucide-react'
import WeeklyScheduleCalendar from '@/components/schedule/WeeklyScheduleCalendar'
import {
  CALENDAR_DAY_ORDER,
  DAY_LABELS,
  formatTime12h,
  hoursBetween,
  weeklyHours,
  type ScheduleAssignmentDTO,
} from '@/lib/rbt-schedule/utils'

export default function RbtScheduleView() {
  const [assignments, setAssignments] = useState<ScheduleAssignmentDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/rbt/schedule', { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setError(data.error || 'Failed to load schedule')
          return
        }
        if (!cancelled) setAssignments(data.assignments ?? [])
      } catch {
        if (!cancelled) setError('Failed to load schedule')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const hours = weeklyHours(assignments)
  const thisWeekCount = assignments.length

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-2 border-red-100">
        <CardContent className="py-12 text-center text-red-600">{error}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">My Schedule</h1>
          <p className="text-blue-50 text-lg">Your weekly client assignments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Shifts</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{thisWeekCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{thisWeekCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hours</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{hours.toFixed(0)}h</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Weekly calendar</h2>
        <WeeklyScheduleCalendar assignments={assignments} readOnly />
      </div>

      <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">Weekly assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 mb-2">No upcoming shifts scheduled</p>
              <p className="text-gray-500">Your schedule will appear here once an admin assigns clients</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments
                .slice()
                .sort((a, b) => {
                  const ao = (CALENDAR_DAY_ORDER as readonly number[]).indexOf(a.dayOfWeek)
                  const bo = (CALENDAR_DAY_ORDER as readonly number[]).indexOf(b.dayOfWeek)
                  return ao - bo || a.startTime.localeCompare(b.startTime)
                })
                .map((a) => (
                  <div
                    key={a.id}
                    className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:shadow-md transition-all"
                  >
                    <h3 className="font-bold text-xl text-gray-900 mb-2">{a.clientName}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {DAY_LABELS[a.dayOfWeek]}s
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime12h(a.startTime)}–{formatTime12h(a.endTime)}
                      </span>
                      <span className="font-medium text-gray-700">
                        {hoursBetween(a.startTime, a.endTime).toFixed(1)}h
                      </span>
                    </div>
                    {a.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-200">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{a.location}</span>
                      </div>
                    )}
                    {a.notes && (
                      <p className="text-sm text-gray-500 mt-2">{a.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {DAY_LABELS[a.dayOfWeek]}s {formatTime12h(a.startTime)}–{formatTime12h(a.endTime)} with{' '}
                      {a.clientName}
                      {a.location ? ` at ${a.location}` : ''}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
