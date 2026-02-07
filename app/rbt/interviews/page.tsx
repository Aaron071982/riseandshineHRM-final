import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Calendar, Clock, User, Video } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InterviewsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  const user = await validateSession(sessionToken)
  // Allow both CANDIDATE and RBT roles to view interviews
  if (!user || !user.rbtProfileId || (user.role !== 'RBT' && user.role !== 'CANDIDATE')) {
    redirect('/')
  }

  // Get interviews for this RBT profile
  let interviews: Awaited<ReturnType<typeof prisma.interview.findMany>> = []
  try {
    interviews = await prisma.interview.findMany({
      where: {
        rbtProfileId: user.rbtProfileId,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    })
  } catch (error) {
    console.error('RBT interviews: failed to load', error)
  }

  const upcomingInterviews = interviews.filter(i => 
    new Date(i.scheduledAt) >= new Date() && i.status === 'SCHEDULED'
  )
  const pastInterviews = interviews.filter(i => 
    new Date(i.scheduledAt) < new Date() || i.status !== 'SCHEDULED'
  )

  const statusColors: Record<string, { bg: string; text: string }> = {
    SCHEDULED: { bg: 'bg-blue-50', text: 'text-blue-700' },
    COMPLETED: { bg: 'bg-green-50', text: 'text-green-700' },
    NO_SHOW: { bg: 'bg-red-50', text: 'text-red-700' },
    CANCELED: { bg: 'bg-gray-50', text: 'text-gray-700' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Interviews</h1>
        <p className="text-gray-600 mt-1">View your scheduled and past interviews</p>
      </div>

      {/* Upcoming Interviews */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Interviews</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingInterviews.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No upcoming interviews scheduled</p>
          ) : (
            <div className="space-y-4">
              {upcomingInterviews.map((interview) => {
                const statusConfig = statusColors[interview.status] || statusColors.SCHEDULED
                return (
                  <div key={interview.id} className="border rounded-lg p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 mb-2">Interview with {interview.interviewerName}</h3>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDateTime(interview.scheduledAt)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{interview.durationMinutes} minutes</span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0`}>
                        {interview.status}
                      </Badge>
                    </div>
                    {interview.meetingUrl && (
                      <div className="mt-4 pt-4 border-t">
                        <a
                          href={interview.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Video className="h-4 w-4" />
                          Join Meeting
                        </a>
                      </div>
                    )}
                    {interview.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Notes:</span> {interview.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Interviews */}
      {pastInterviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pastInterviews.map((interview) => {
                const statusConfig = statusColors[interview.status] || statusColors.COMPLETED
                return (
                  <div key={interview.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{formatDateTime(interview.scheduledAt)}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {interview.interviewerName} • {interview.durationMinutes} min
                        </p>
                        {interview.notes && (
                          <p className="text-sm text-gray-600 mt-2">{interview.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0`}>
                          {interview.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {interview.decision}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

