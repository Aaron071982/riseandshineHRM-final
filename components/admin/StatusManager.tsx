'use client'

import { CheckCircle2, Circle, MinusCircle } from 'lucide-react'

type RBTStatus = 'NEW' | 'REACH_OUT' | 'REACH_OUT_EMAIL_SENT' | 'TO_INTERVIEW' | 'INTERVIEW_SCHEDULED' | 'INTERVIEW_COMPLETED' | 'HIRED' | 'STALLED' | 'REJECTED'

interface StatusManagerProps {
  rbtId: string
  initialStatus: RBTStatus
  onStatusChange?: (newStatus: RBTStatus) => void
}

const TIMELINE_STEPS: Array<{ status: RBTStatus; label: string }> = [
  { status: 'NEW', label: 'Applied' },
  { status: 'REACH_OUT_EMAIL_SENT', label: 'Reach-Out Email Sent' },
  { status: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
  { status: 'INTERVIEW_COMPLETED', label: 'Interview Completed' },
  { status: 'HIRED', label: 'Hired' },
  { status: 'STALLED', label: 'Stalled' },
  { status: 'REJECTED', label: 'Rejected' },
]

const ORDER: Record<RBTStatus, number> = {
  NEW: 0,
  REACH_OUT: 0,
  REACH_OUT_EMAIL_SENT: 1,
  TO_INTERVIEW: 1,
  INTERVIEW_SCHEDULED: 2,
  INTERVIEW_COMPLETED: 3,
  HIRED: 4,
  STALLED: 4,
  REJECTED: 4,
}

export default function StatusManager({ initialStatus }: StatusManagerProps) {
  const currentOrder = ORDER[initialStatus] ?? -1
  const isOutcome = initialStatus === 'HIRED' || initialStatus === 'STALLED' || initialStatus === 'REJECTED'

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)]">Status timeline</p>
      <div className="flex flex-wrap items-center gap-2">
        {TIMELINE_STEPS.map((step, idx) => {
          const stepOrder = ORDER[step.status]
          const isCompleted = currentOrder > stepOrder || (currentOrder === stepOrder && step.status === initialStatus)
          const isCurrent = step.status === initialStatus
          const isOutcomeStep = step.status === 'HIRED' || step.status === 'STALLED' || step.status === 'REJECTED'
          const showOutcome = isOutcome && isOutcomeStep && step.status === initialStatus

          if (isOutcomeStep && !showOutcome && !isCurrent) {
            if (idx > 0 && TIMELINE_STEPS[idx - 1].status !== 'INTERVIEW_COMPLETED') return null
            return (
              <span key={step.status} className="flex items-center gap-1.5 text-gray-400 dark:text-[var(--text-disabled)]">
                <Circle className="h-4 w-4" />
                <span className="text-sm">{step.label}</span>
              </span>
            )
          }
          if (isOutcomeStep && !showOutcome) return null

          return (
            <span
              key={step.status}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium ${
                isCurrent
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30 dark:bg-[var(--orange-subtle)] dark:text-[var(--orange-primary)] dark:ring-[var(--orange-border)]'
                  : isCompleted
                    ? 'bg-green-50 text-green-700 dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)]'
                    : 'text-gray-500 dark:text-[var(--text-tertiary)]'
              }`}
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-[var(--status-hired-text)]" /> : isCurrent ? <MinusCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {step.label}
            </span>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">Use the actions below to change status. Every change requires confirmation.</p>
    </div>
  )
}
