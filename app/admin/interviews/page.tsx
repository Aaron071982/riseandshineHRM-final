import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { Calendar, Clock, User, Video } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import InterviewNotesButton from '@/components/admin/InterviewNotesButton'

export default async function InterviewsPage() {
  const interviews = await prisma.interview.findMany({
    include: {
      rbtProfile: true,
    },
    orderBy: {
      scheduledAt: 'desc',
    },
  })

  const statusColors: Record<string, { bg: string; text: string }> = {
    SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700' },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
    NO_SHOW: { bg: 'bg-red-100', text: 'text-red-700' },
    CANCELED: { bg: 'bg-gray-100', text: 'text-gray-700' },
  }

  const scheduledInterviews = interviews.filter(i => i.status === 'SCHEDULED')
  const completedInterviews = interviews.filter(i => i.status === 'COMPLETED')

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Interviews</h1>
          <p className="text-blue-50 text-lg">Manage all interviews and scheduling</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-hover border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Interviews</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{interviews.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{scheduledInterviews.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{completedInterviews.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center">
                <Video className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interviews List */}
      <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">All Interviews</CardTitle>
        </CardHeader>
        <CardContent>
          {interviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 mb-2">No interviews scheduled</p>
              <p className="text-gray-500">Start scheduling interviews from candidate profiles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interviews.map((interview) => {
                const statusConfig = statusColors[interview.status] || statusColors.CANCELED
                return (
                  <div
                    key={interview.id}
                    className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:shadow-lg transition-all card-hover relative overflow-hidden"
                  >
                    {/* Decorative bubble */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100/30 rounded-full -mr-10 -mt-10" />
                    
                    <div className="relative grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                      <div className="md:col-span-2">
                        <div className="flex items-center gap-3 mb-2">
                          <User className="h-5 w-5 text-gray-400" />
                          <h3 className="font-bold text-lg text-gray-900">
                            {interview.rbtProfile.firstName} {interview.rbtProfile.lastName}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 ml-8">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDateTime(interview.scheduledAt)}</span>
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Clock className="h-4 w-4" />
                          <span>{interview.durationMinutes} minutes</span>
                        </div>
                        <div className="text-gray-600">
                          Interviewer: <span className="font-medium">{interview.interviewerName}</span>
                        </div>
                      </div>
                      
                      <div>
                        <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0 font-medium px-3 py-1`}>
                          {interview.status}
                        </Badge>
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            {interview.decision}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <InterviewNotesButton
                          interviewId={interview.id}
                          rbtProfileId={interview.rbtProfile.id}
                        />
                        <Link href={`/admin/rbts/${interview.rbtProfile.id}`}>
                          <Button variant="outline" size="sm" className="rounded-lg border-2 hover:bg-blue-50">
                            View Profile →
                          </Button>
                        </Link>
                      </div>
                    </div>
                    
                    {interview.meetingUrl && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <a
                          href={interview.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
                        >
                          <Video className="h-4 w-4" />
                          Join Meeting
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
