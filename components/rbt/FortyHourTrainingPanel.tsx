'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  FORTY_HOUR_RBT_COURSE_LABEL,
  FORTY_HOUR_RBT_COURSE_PROVIDER,
  FORTY_HOUR_RBT_COURSE_URL,
} from '@/lib/onboarding/catalog'
import DocumentUploadFlow from '@/components/onboarding/DocumentUploadFlow'

export default function FortyHourTrainingPanel({
  documentId,
  alreadyComplete,
  showContinueLink = true,
  onComplete,
}: {
  documentId?: string | null
  alreadyComplete: boolean
  showContinueLink?: boolean
  onComplete?: () => void
}) {
  if (alreadyComplete) {
    return (
      <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/20">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
          <div>
            <h2 className="text-lg font-semibold text-green-900 dark:text-green-100">
              40-hour RBT course complete
            </h2>
            <p className="mt-1 text-sm text-green-800 dark:text-green-200">
              Your certificate is on file. You can still reopen the{' '}
              {FORTY_HOUR_RBT_COURSE_PROVIDER} training if you want a refresher.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={FORTY_HOUR_RBT_COURSE_URL} target="_blank" rel="noopener noreferrer">
              Open course
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
          {showContinueLink && (
            <Button asChild className="bg-[#e36f1e] hover:bg-[#c95e18]">
              <Link href="/rbt/tasks">Continue onboarding</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 dark:border-amber-600 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Required first step · cannot be skipped
            </p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
              Complete the 40-hour RBT course
            </h2>
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              This training is mandatory. You cannot finish onboarding, sit for the RBT exam, or
              work independently with clients until you complete it and upload your certificate.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-orange-200 bg-white p-5 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[#e36f1e]" />
          <h3 className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">
            {FORTY_HOUR_RBT_COURSE_PROVIDER} — free 40-hour training
          </h3>
        </div>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-[var(--text-secondary)]">
          <li>
            Aligns with <strong>2026 BACB requirements</strong> for Registered Behavior Technician
            certification.
          </li>
          <li>
            Teaches how we support learning, play, and communication — this is the foundation of
            the job.
          </li>
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#e36f1e]" />
            <span>
              About 40 hours. Work at your own pace, then come back here to upload the certificate.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
          You may continue other onboarding tasks while the course is in progress. Return to this
          tab anytime. Onboarding is not complete until this course is done.
        </p>
        <Button asChild className="mt-4 bg-[#e36f1e] hover:bg-[#c95e18]">
          <a href={FORTY_HOUR_RBT_COURSE_URL} target="_blank" rel="noopener noreferrer">
            {FORTY_HOUR_RBT_COURSE_LABEL}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        <p className="mt-2 text-xs text-gray-500">
          Opens {FORTY_HOUR_RBT_COURSE_PROVIDER} in a new tab. Register or log in on their site to
          begin.
        </p>
      </div>

      {documentId && onComplete && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
          <DocumentUploadFlow
            documentId={documentId}
            title="Upload your certificate of completion"
            description="When the course is finished, upload the certificate here so we can verify it."
            onComplete={onComplete}
          />
        </div>
      )}

      {showContinueLink && (
        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
          Ready to work on paperwork in the meantime?{' '}
          <Link href="/rbt/tasks" className="font-medium text-[#e36f1e] hover:underline">
            Continue later steps in My Tasks
          </Link>
          . Come back and finish this course — it is still required.
        </p>
      )}
    </div>
  )
}
