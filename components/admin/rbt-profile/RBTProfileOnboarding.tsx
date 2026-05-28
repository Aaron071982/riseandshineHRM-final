'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, FileText, Download } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { getAcknowledgmentAdminSummary } from '@/lib/acknowledgment-admin-summary'
import { ONBOARDING_CATALOG, RBT_VISIBLE_STEPS } from '@/lib/onboarding/catalog'
import AcknowledgmentAuditPanel from '@/components/admin/AcknowledgmentAuditPanel'
import type { RBTProfile } from './types'

type ToastFn = (message: string, type: 'success' | 'error') => void

interface RBTProfileOnboardingProps {
  rbtProfile: RBTProfile
  showToast: ToastFn
  backgroundCheckClearedAt?: string | null
  supervisionCountersignedAt?: string | null
}

export default function RBTProfileOnboarding({
  rbtProfile,
  showToast,
  backgroundCheckClearedAt,
  supervisionCountersignedAt,
}: RBTProfileOnboardingProps) {
  const isHired = rbtProfile.status === 'HIRED'
  if (!isHired) return null

  const [serverProgress, setServerProgress] = useState<{
    completedCount: number
    totalRbtSteps: number
    tierACompleted: number
    tierATotal: number
    backgroundCheckClearedAt: string | null
    supervisionCountersignedAt: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/rbts/${rbtProfile.id}/onboarding-progress`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.completedCount != null) {
          setServerProgress({
            completedCount: data.completedCount,
            totalRbtSteps: data.totalRbtSteps,
            tierACompleted: data.tierACompleted,
            tierATotal: data.tierATotal,
            backgroundCheckClearedAt: data.backgroundCheckClearedAt ?? null,
            supervisionCountersignedAt: data.supervisionCountersignedAt ?? null,
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [rbtProfile.id])

  const bgClearedAt = backgroundCheckClearedAt ?? serverProgress?.backgroundCheckClearedAt ?? null
  const supCountersignedAt =
    supervisionCountersignedAt ?? serverProgress?.supervisionCountersignedAt ?? null

  const completions = useMemo(() => {
    const slugToStep = new Map(
      ONBOARDING_CATALOG.filter((e) => e.stepNumber != null).map((e) => [e.slug, e.stepNumber!])
    )
    const list = (rbtProfile.onboardingCompletions ?? []).map((c) => {
      const step =
        c.document.stepNumber ??
        (c.document.slug ? slugToStep.get(c.document.slug) : undefined) ??
        null
      return {
        ...c,
        document: { ...c.document, stepNumber: step },
      }
    })
    const rbtOnly = list.filter((c) => {
      const step = c.document.stepNumber
      if (step == null) return true
      return step <= RBT_VISIBLE_STEPS
    })
    return [...rbtOnly].sort((a, b) => {
      const sa = a.document.stepNumber ?? 999
      const sb = b.document.stepNumber ?? 999
      return sa - sb
    })
  }, [rbtProfile.onboardingCompletions])

  const isStepComplete = (c: (typeof completions)[0]) => {
    if (c.status === 'COMPLETED') return true
    const slug = c.document.slug
    if (slug === 'background-check-cleared' && bgClearedAt) return true
    if (slug === 'supervision-countersigned' && supCountersignedAt) return true
    return false
  }

  const completedCount =
    serverProgress?.completedCount ??
    completions.filter((c) => isStepComplete(c)).length
  const totalCount = serverProgress?.totalRbtSteps ?? RBT_VISIBLE_STEPS
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleDownloadSsnTask = async (taskId: string) => {
    try {
      const response = await fetch(
        `/api/admin/rbts/${rbtProfile.id}/onboarding-tasks/${taskId}/download`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const blob = await response.blob()
        const cd = response.headers.get('Content-Disposition')
        const match = cd?.match(/filename="([^"]+)"/)
        const filename = match?.[1] || 'social-security-card.pdf'
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        showToast('Download started', 'success')
      } else {
        const err = await response.json().catch(() => ({}))
        showToast((err as { error?: string })?.error || 'Failed to download', 'error')
      }
    } catch {
      showToast('Failed to download file', 'error')
    }
  }

  const handleDownloadCompletion = async (completionId: string, title: string) => {
    try {
      const response = await fetch(
        `/api/admin/onboarding/completions/${rbtProfile.id}/${completionId}/download`
      )
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        showToast('PDF downloaded successfully', 'success')
      } else {
        const error = await response.json()
        showToast((error as { error?: string })?.error || 'Failed to download PDF', 'error')
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
      showToast('An error occurred while downloading the PDF', 'error')
    }
  }

  const legacySsnTasks = rbtProfile.onboardingTasks.filter(
    (task) =>
      task.taskType === 'SOCIAL_SECURITY_DOCUMENT' &&
      task.isCompleted &&
      !task.title?.toLowerCase().includes('download onboarding documents folder')
  )

  return (
    <>
      <Card className="border-2 border-gray-200 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            Onboarding Progress
          </CardTitle>
          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
            Based on catalog document completions (same as the list below)
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium dark:text-[var(--text-tertiary)]">Overall Progress</span>
                <span className="font-bold dark:text-[var(--text-primary)]">
                  {completedCount} / {totalCount} steps completed
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-[var(--bg-input)] rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${
                    progressPct === 100 ? 'bg-green-500' : 'bg-orange-600'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-[var(--text-disabled)]">
                {progressPct}% complete
                {serverProgress ? (
                  <span className="block text-xs mt-0.5">
                    Tier A: {serverProgress.tierACompleted}/{serverProgress.tierATotal}
                  </span>
                ) : null}
              </div>
            </div>

            {completions.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">Steps</h3>
                {completions.map((completion) => {
                  const step = (completion.document as { stepNumber?: number | null }).stepNumber
                  return (
                    <div
                      key={completion.id}
                      className="border dark:border-[var(--border-subtle)] rounded-lg p-3 dark:bg-[var(--bg-elevated)] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isStepComplete(completion) ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate dark:text-[var(--text-primary)]">
                          {step != null ? `Step ${step}: ` : ''}
                          {completion.document.title}
                        </span>
                      </div>
                      <Badge
                        className={
                          completion.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700 shrink-0'
                            : 'bg-gray-100 text-gray-600 shrink-0'
                        }
                      >
                        {isStepComplete(completion)
                          ? 'Completed'
                          : completion.status === 'IN_PROGRESS'
                            ? 'In progress'
                            : 'Not started'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}

            {legacySsnTasks.length > 0 && (
              <div className="space-y-2 pt-4 border-t dark:border-[var(--border-subtle)]">
                <h3 className="font-semibold text-sm text-gray-700 dark:text-[var(--text-secondary)]">
                  Legacy uploads
                </h3>
                {legacySsnTasks.map((task) => (
                  <Button
                    key={task.id}
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadSsnTask(task.id)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download SSN card
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-gray-200 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            Onboarding Documents
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
            Acknowledgment and fillable PDF completions
          </p>
        </CardHeader>
        <CardContent>
          {completions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
              <p className="text-sm">No onboarding documents completed yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completions.map((completion) => (
                <div
                  key={completion.id}
                  className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-elevated)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {completion.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-[var(--status-hired-text)]" />
                        ) : completion.status === 'IN_PROGRESS' ? (
                          <XCircle className="w-5 h-5 text-yellow-500 dark:text-[var(--status-warning-text)]" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400 dark:text-[var(--text-disabled)]" />
                        )}
                        <h4 className="font-medium dark:text-[var(--text-primary)]">
                          {completion.document.title}
                        </h4>
                        <Badge variant="outline" className="ml-2 dark:border-[var(--border-subtle)]">
                          {completion.document.type === 'ACKNOWLEDGMENT' ? 'Acknowledgment' : 'Fillable PDF'}
                        </Badge>
                      </div>
                      {completion.completedAt && (
                        <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1 ml-7">
                          Completed: {formatDateTime(completion.completedAt)}
                        </p>
                      )}
                      {completion.document.type === 'ACKNOWLEDGMENT' &&
                        completion.status === 'COMPLETED' && (
                          <>
                            {(() => {
                              const { topic, attestation } = getAcknowledgmentAdminSummary({
                                documentTitle: completion.document.title,
                                documentSlug: completion.document.slug,
                                acknowledgmentJson: completion.acknowledgmentJson,
                              })
                              return (
                                <div className="mt-3 ml-7 rounded-md border border-gray-200 dark:border-[var(--border-subtle)] bg-gray-50/80 dark:bg-[var(--bg-input)] p-3 space-y-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Acknowledgment summary
                                  </p>
                                  <p className="text-sm text-gray-700 dark:text-[var(--text-secondary)]">
                                    <span className="font-medium">What they reviewed: </span>
                                    {topic}
                                  </p>
                                  <p className="text-sm text-gray-700 dark:text-[var(--text-secondary)]">
                                    <span className="font-medium">What they agreed to: </span>
                                    {attestation}
                                  </p>
                                </div>
                              )
                            })()}
                            <div className="ml-7">
                              <AcknowledgmentAuditPanel
                                completion={completion}
                                documentTitle={completion.document.title}
                              />
                            </div>
                          </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          completion.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : completion.status === 'IN_PROGRESS'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                        }
                      >
                        {completion.status === 'COMPLETED'
                          ? 'Completed'
                          : completion.status === 'IN_PROGRESS'
                            ? 'In Progress'
                            : 'Not Started'}
                      </Badge>
                      {completion.status === 'COMPLETED' && completion.document.type === 'FILLABLE_PDF' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadCompletion(completion.id, completion.document.title)}
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
