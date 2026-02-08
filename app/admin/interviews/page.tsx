import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { Calendar, Clock, User, Video, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import InterviewNotesButton from '@/components/admin/InterviewNotesButton'
import InterviewDeleteButton from '@/components/admin/InterviewDeleteButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InterviewsPage() {
  type InterviewWithRbtProfile = Prisma.InterviewGetPayload<{ include: { rbtProfile: true } }>
  let interviews: InterviewWithRbtProfile[] = []
  try {
    interviews = await prisma.interview.findMany({
      include: {
        rbtProfile: true,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    })
  } catch (error) {
    console.error('Admin interviews: failed to load', error)
    try {
      const raw = await prisma.$queryRaw<
        Array<{
          id: string
          scheduledAt: Date
          durationMinutes: number
          interviewerName: string
          status: string
          decision: string
          meetingUrl: string | null
          rbtProfileId: string
          firstName: string
          lastName: string
        }>
      >`
        SELECT i.id, i."scheduledAt", i."durationMinutes", i."interviewerName", i.status, i.decision, i."meetingUrl", i."rbtProfileId",
               r."firstName", r."lastName"
        FROM interviews i
        JOIN rbt_profiles r ON r.id = i."rbtProfileId"
        ORDER BY i."scheduledAt" DESC
      `
      interviews = raw.map((row) => ({
        id: row.id,
        scheduledAt: row.scheduledAt,
        durationMinutes: row.durationMinutes,
        interviewerName: row.interviewerName,
        status: row.status,
        decision: row.decision,
        meetingUrl: row.meetingUrl,
        rbtProfileId: row.rbtProfileId,
        rbtProfile: {
          id: row.rbtProfileId,
          firstName: row.firstName,
          lastName: row.lastName,
        } as any,
      })) as InterviewWithRbtProfile[]
    } catch (rawErr) {
      console.error('Admin interviews: raw fallback failed', rawErr)
    }
  }

  const statusColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
    SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'dark:bg-[var(--status-interview-bg)]', darkText: 'dark:text-[var(--status-interview-text)]' },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'dark:bg-[var(--status-hired-bg)]', darkText: 'dark:text-[var(--status-hired-text)]' },
    NO_SHOW: { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-[var(--status-rejected-bg)]', darkText: 'dark:text-[var(--status-rejected-text)]' },
    CANCELED: { bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'dark:bg-[var(--bg-elevated)]', darkText: 'dark:text-[var(--text-primary)]' },
  }

  const now = new Date()
  const scheduledInterviews = interviews.filter(i => i.status === 'SCHEDULED')
  const upcomingInterviews = scheduledInterviews.filter(i => new Date(i.scheduledAt) >= now)
  const pastInterviews = interviews.filter(i => i.status !== 'SCHEDULED' || new Date(i.scheduledAt) < now)
  const completedInterviews = interviews.filter(i => i.status === 'COMPLETED')

  return (
    <div className="space-y-6">
      {/* Header with gradient banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 via-purple-400 to-violet-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Interviews</h1>
          <p className="text-purple-50 text-lg">Manage all interviews and scheduling</p>
        </div>
      </div>

      {/* Stats Cards with colored borders and gradient icons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-hover border-2 border-blue-200 dark:border-blue-800/40 bg-gradient-to-br from-white to-blue-50 dark:from-[var(--bg-elevated)] dark:to-blue-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Total Interviews</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-[var(--status-interview-text)] mt-2">{interviews.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 dark:border-green-800/40 bg-gradient-to-br from-white to-green-50 dark:from-[var(--bg-elevated)] dark:to-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Scheduled</p>
                <p className="text-3xl font-bold text-green-600 dark:text-[var(--status-hired-text)] mt-2">{scheduledInterviews.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-purple-200 dark:border-purple-800/40 bg-gradient-to-br from-white to-purple-50 dark:from-[var(--bg-elevated)] dark:to-purple-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Completed</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-[var(--status-onboarding-text)] mt-2">{completedInterviews.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center">
                <Video className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interviews List */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">All Interviews</CardTitle>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">Upcoming first, then past. Join opens the meeting link.</p>
        </CardHeader>
        <CardContent>
          {interviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 dark:text-[var(--text-secondary)] mb-2">No interviews scheduled</p>
              <p className="text-gray-500 dark:text-[var(--text-tertiary)]">Start scheduling interviews from candidate profiles</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingInterviews.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)] mb-2">Upcoming</h3>
                  <div className="space-y-3">
                    {upcomingInterviews.map((interview) => {
                      const statusConfig = statusColors[interview.status] || statusColors.CANCELED
                      const endAt = new Date(interview.scheduledAt.getTime() + (interview.durationMinutes || 30) * 60 * 1000)
                      return (
                        <div
                          key={interview.id}
                          className="border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg p-5 bg-gray-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                            <div className="md:col-span-2">
                              <div className="flex items-center gap-3 mb-2">
                                <User className="h-5 w-5 text-gray-400 dark:text-[var(--text-disabled)]" />
                                <h3 className="font-bold text-lg text-gray-900 dark:text-[var(--text-primary)]">
                                  {interview.rbtProfile.firstName} {interview.rbtProfile.lastName}
                                </h3>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[var(--text-tertiary)] ml-8">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDateTime(interview.scheduledAt)} – {formatDateTime(endAt).split(', ')[1]}</span>
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="flex items-center gap-2 text-gray-600 dark:text-[var(--text-tertiary)] mb-1">
                                <Clock className="h-4 w-4" />
                                <span>{interview.durationMinutes || 30} min</span>
                              </div>
                              <div className="text-gray-600 dark:text-[var(--text-tertiary)]">Interviewer: <span className="font-medium">{interview.interviewerName}</span></div>
                            </div>
                            <div>
                              <Badge className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.darkBg} ${statusConfig.darkText} border-0 font-medium px-3 py-1`}>{interview.status}</Badge>
                              <div className="mt-2"><Badge variant="outline" className="text-xs dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">{interview.decision}</Badge></div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <InterviewNotesButton interviewId={interview.id} rbtProfileId={interview.rbtProfile.id} />
                              <InterviewDeleteButton interviewId={interview.id} rbtName={`${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}`} scheduledAt={interview.scheduledAt} />
                              <Link href={`/admin/rbts/${interview.rbtProfile.id}`}>
                                <Button variant="outline" size="sm" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]">View Profile →</Button>
                              </Link>
                            </div>
                          </div>
                          {interview.meetingUrl && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[var(--border-subtle)]">
                              <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 dark:text-[var(--orange-primary)] dark:hover:text-[var(--orange-hover)] font-medium flex items-center gap-2">
                                <Video className="h-4 w-4" /> Join Meeting
                              </a>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {pastInterviews.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)] mb-2">Past</h3>
                  <div className="space-y-3">
                    {pastInterviews.map((interview) => {
                      const statusConfig = statusColors[interview.status] || statusColors.CANCELED
                      const endAt = new Date(interview.scheduledAt.getTime() + (interview.durationMinutes || 30) * 60 * 1000)
                      return (
                        <div
                          key={interview.id}
                          className="border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg p-5 bg-gray-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                            <div className="md:col-span-2">
                              <div className="flex items-center gap-3 mb-2">
                                <User className="h-5 w-5 text-gray-400 dark:text-[var(--text-disabled)]" />
                                <h3 className="font-bold text-lg text-gray-900 dark:text-[var(--text-primary)]">
                                  {interview.rbtProfile.firstName} {interview.rbtProfile.lastName}
                                </h3>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[var(--text-tertiary)] ml-8">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDateTime(interview.scheduledAt)} – {formatDateTime(endAt).split(', ')[1]}</span>
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="flex items-center gap-2 text-gray-600 dark:text-[var(--text-tertiary)] mb-1">
                                <Clock className="h-4 w-4" />
                                <span>{interview.durationMinutes || 30} min</span>
                              </div>
                              <div className="text-gray-600 dark:text-[var(--text-tertiary)]">Interviewer: <span className="font-medium">{interview.interviewerName}</span></div>
                            </div>
                            <div>
                              <Badge className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.darkBg} ${statusConfig.darkText} border-0 font-medium px-3 py-1`}>{interview.status}</Badge>
                              <div className="mt-2"><Badge variant="outline" className="text-xs dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">{interview.decision}</Badge></div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <InterviewNotesButton interviewId={interview.id} rbtProfileId={interview.rbtProfile.id} />
                              <InterviewDeleteButton interviewId={interview.id} rbtName={`${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}`} scheduledAt={interview.scheduledAt} />
                              <Link href={`/admin/rbts/${interview.rbtProfile.id}`}>
                                <Button variant="outline" size="sm" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]">View Profile →</Button>
                              </Link>
                            </div>
                          </div>
                          {interview.meetingUrl && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[var(--border-subtle)]">
                              <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 dark:text-[var(--orange-primary)] dark:hover:text-[var(--orange-hover)] font-medium flex items-center gap-2">
                                <Video className="h-4 w-4" /> Join Meeting
                              </a>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
