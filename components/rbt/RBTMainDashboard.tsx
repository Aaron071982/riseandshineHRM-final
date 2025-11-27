import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Calendar, Clock, CalendarDays } from 'lucide-react'
import Link from 'next/link'

interface RBTMainDashboardProps {
  rbtProfileId: string
}

export default async function RBTMainDashboard({ rbtProfileId }: RBTMainDashboardProps) {
  const [rbtProfile, todayShifts, upcomingShifts, timeEntries, leaveRequests, upcomingInterviews] = await Promise.all([
    prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
    }),
    prisma.shift.findMany({
      where: {
        rbtProfileId,
        startTime: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { not: 'CANCELED' },
      },
      orderBy: {
        startTime: 'asc',
      },
    }),
    prisma.shift.findMany({
      where: {
        rbtProfileId,
        startTime: {
          gt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { not: 'CANCELED' },
      },
      orderBy: {
        startTime: 'asc',
      },
      take: 5,
    }),
    prisma.timeEntry.findMany({
      where: {
        rbtProfileId,
        clockInTime: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7)),
        },
      },
      orderBy: {
        clockInTime: 'desc',
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        rbtProfileId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    }),
    prisma.interview.findMany({
      where: {
        rbtProfileId,
        scheduledAt: {
          gte: new Date(),
        },
        status: 'SCHEDULED',
      },
      orderBy: {
        scheduledAt: 'asc',
      },
      take: 3,
    }),
  ])

  if (!rbtProfile) {
    return <div>Profile not found</div>
  }

  // Calculate hours this week and month
  const now = new Date()
  const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
  weekStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const hoursThisWeek = timeEntries
    .filter((entry) => entry.clockInTime >= weekStart && entry.totalHours)
    .reduce((sum, entry) => sum + (entry.totalHours || 0), 0)

  const hoursThisMonth = timeEntries
    .filter((entry) => entry.clockInTime >= monthStart && entry.totalHours)
    .reduce((sum, entry) => sum + (entry.totalHours || 0), 0)

  const statusColors: Record<string, string> = {
    SCHEDULED: 'bg-blue-500',
    COMPLETED: 'bg-green-500',
    CANCELED: 'bg-gray-500',
  }

  const leaveStatusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500',
    APPROVED: 'bg-green-500',
    DENIED: 'bg-red-500',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Hi, {rbtProfile.firstName}! Here's your schedule and work summary.
        </h1>
      </div>

      {/* Hours Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hoursThisWeek.toFixed(2)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours This Month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hoursThisMonth.toFixed(2)}h</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Interviews */}
      {upcomingInterviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingInterviews.map((interview) => (
                <div key={interview.id} className="border rounded-lg p-4 bg-blue-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Interview with {interview.interviewerName}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDateTime(interview.scheduledAt)} • {interview.durationMinutes} min
                      </p>
                      {interview.meetingUrl && (
                        <a
                          href={interview.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                        >
                          Join Meeting →
                        </a>
                      )}
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 border-0">Scheduled</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/rbt/interviews">
                <Button variant="outline" className="w-full">
                  View All Interviews
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {todayShifts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No shifts scheduled for today</p>
          ) : (
            <div className="space-y-4">
              {todayShifts.map((shift) => (
                <div key={shift.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{shift.clientName}</p>
                      <p className="text-sm text-gray-600">
                        {formatDateTime(shift.startTime)} - {formatDateTime(shift.endTime)}
                      </p>
                      {shift.locationAddress && (
                        <p className="text-sm text-gray-600 mt-1">{shift.locationAddress}</p>
                      )}
                    </div>
                    <Badge
                      className={`${statusColors[shift.status] || 'bg-gray-500'} text-white`}
                    >
                      {shift.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Shifts */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingShifts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No upcoming shifts</p>
          ) : (
            <div className="space-y-4">
              {upcomingShifts.map((shift) => (
                <div key={shift.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{shift.clientName}</p>
                      <p className="text-sm text-gray-600">
                        {formatDate(shift.startTime)} • {new Date(shift.startTime).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        - {new Date(shift.endTime).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                      {shift.locationAddress && (
                        <p className="text-sm text-gray-600 mt-1">{shift.locationAddress}</p>
                      )}
                    </div>
                    <Badge
                      className={`${statusColors[shift.status] || 'bg-gray-500'} text-white`}
                    >
                      {shift.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {upcomingShifts.length > 0 && (
            <div className="mt-4">
              <Link href="/rbt/schedule">
                <Button variant="outline" className="w-full">
                  View Full Schedule
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No leave requests</p>
          ) : (
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{request.type}</p>
                      <p className="text-sm text-gray-600">
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </p>
                      {request.reason && (
                        <p className="text-sm text-gray-600 mt-1">{request.reason}</p>
                      )}
                    </div>
                    <Badge
                      className={`${leaveStatusColors[request.status] || 'bg-gray-500'} text-white`}
                    >
                      {request.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Link href="/rbt/leave">
              <Button variant="outline" className="w-full">
                Request Time Off
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

