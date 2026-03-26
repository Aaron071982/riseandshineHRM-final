'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import InterviewNotesButton from '@/components/admin/InterviewNotesButton'
import type { RBTProfile, RBTProfileInterview } from './types'

interface RBTProfileInterviewsProps {
  rbtProfile: RBTProfile
  loading: boolean
  onCompleteInterview: (interviewId: string) => void
  onHire: () => void
  onReject: () => void
}

export default function RBTProfileInterviews({
  rbtProfile,
  loading,
  onCompleteInterview,
  onHire,
  onReject,
}: RBTProfileInterviewsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const interviews = rbtProfile.interviews
  if (interviews.length === 0) return null

  return (
    <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Interview History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interviews.map((interview: RBTProfileInterview) => {
            const isScheduled = interview.status === 'SCHEDULED'
            const isCompleted = interview.status === 'COMPLETED'
            const isPast = new Date(interview.scheduledAt) < new Date()
            const canMarkCompleted = isScheduled && isPast
            const canHireOrReject = isCompleted && rbtProfile.status === 'INTERVIEW_COMPLETED'
            const hasNotes = !!interview.interviewNotes
            const isExpanded = expandedId === interview.id

            return (
              <div key={interview.id} className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-elevated)]">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium dark:text-[var(--text-primary)]">
                      {formatDateTime(interview.scheduledAt)} ({interview.durationMinutes} min)
                    </p>
                    <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                      Interviewer: {interview.interviewerName}
                    </p>
                    {interview.notes && (
                      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-2">{interview.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">{interview.status}</Badge>
                      <Badge variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">{interview.decision}</Badge>
                    </div>
                    {canMarkCompleted && (
                      <Button
                        size="sm"
                        onClick={() => onCompleteInterview(interview.id)}
                        disabled={loading}
                        className="dark:bg-[var(--status-interview-bg)] dark:text-[var(--status-interview-text)] border-0"
                      >
                        Mark as Completed
                      </Button>
                    )}
                    {canHireOrReject && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={onHire}
                          disabled={loading}
                          className="dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)] border-0"
                        >
                          Hire
                        </Button>
                        <Button
                          size="sm"
                          onClick={onReject}
                          disabled={loading}
                          variant="destructive"
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {hasNotes && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedId(isExpanded ? null : interview.id)}
                        className="text-gray-600 dark:text-[var(--text-tertiary)]"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                        {isExpanded ? 'Hide notes' : 'View notes'}
                      </Button>
                    )}
                  </div>
                </div>
                {hasNotes && isExpanded && interview.interviewNotes && (
                  <div className="mt-4 pt-4 border-t dark:border-[var(--border-subtle)] space-y-3 text-sm">
                    {(interview.interviewNotes.fullName || interview.interviewNotes.phoneNumber || interview.interviewNotes.email || interview.interviewNotes.currentAddress) && (
                      <div className="space-y-1">
                        <p className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">Basic Information</p>
                        {interview.interviewNotes.fullName && <p className="text-gray-600 dark:text-[var(--text-tertiary)]"><span className="font-medium">Name: </span>{interview.interviewNotes.fullName}</p>}
                        {interview.interviewNotes.phoneNumber && <p className="text-gray-600 dark:text-[var(--text-tertiary)]"><span className="font-medium">Phone: </span>{interview.interviewNotes.phoneNumber}</p>}
                        {interview.interviewNotes.email && <p className="text-gray-600 dark:text-[var(--text-tertiary)]"><span className="font-medium">Email: </span>{interview.interviewNotes.email}</p>}
                        {interview.interviewNotes.currentAddress && <p className="text-gray-600 dark:text-[var(--text-tertiary)]"><span className="font-medium">City / location: </span>{interview.interviewNotes.currentAddress}</p>}
                      </div>
                    )}
                    {interview.interviewNotes.greetingAnswer && <p><span className="font-medium">Greeting &amp; Introduction: </span>{interview.interviewNotes.greetingAnswer}</p>}
                    {interview.interviewNotes.experienceAnswer && <p><span className="font-medium">Experience: </span>{interview.interviewNotes.experienceAnswer}</p>}
                    {interview.interviewNotes.closingNotes && <p><span className="font-medium">Closing notes: </span>{interview.interviewNotes.closingNotes}</p>}
                    <div className="pt-2">
                      <InterviewNotesButton interviewId={interview.id} rbtProfileId={rbtProfile.id} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
