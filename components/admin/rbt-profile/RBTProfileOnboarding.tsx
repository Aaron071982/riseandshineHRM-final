'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, FileText, Download } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { RBTProfile } from './types'

type ToastFn = (message: string, type: 'success' | 'error') => void

interface RBTProfileOnboardingProps {
  rbtProfile: RBTProfile
  showToast: ToastFn
}

export default function RBTProfileOnboarding({ rbtProfile, showToast }: RBTProfileOnboardingProps) {
  const isHired = rbtProfile.status === 'HIRED'
  if (!isHired) return null

  const completedOnboardingTasks = rbtProfile.onboardingTasks.filter((t) => t.isCompleted).length
  const totalOnboardingTasks = rbtProfile.onboardingTasks.length
  const filteredTasks = rbtProfile.onboardingTasks.filter(
    (task) =>
      !task.title?.toLowerCase().includes('download onboarding documents folder') &&
      !task.documentDownloadUrl?.includes('onboarding-package')
  )

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

  return (
    <>
      {/* Onboarding Progress */}
      <Card className="border-2 border-gray-200 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium dark:text-[var(--text-tertiary)]">Overall Progress</span>
                <span className="font-bold dark:text-[var(--text-primary)]">
                  {completedOnboardingTasks} / {totalOnboardingTasks} tasks completed
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-[var(--bg-input)] rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${
                    totalOnboardingTasks > 0 && (completedOnboardingTasks / totalOnboardingTasks) * 100 === 100
                      ? 'bg-green-500'
                      : 'bg-orange-600'
                  }`}
                  style={{
                    width: `${totalOnboardingTasks > 0 ? (completedOnboardingTasks / totalOnboardingTasks) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-[var(--text-disabled)]">
                {totalOnboardingTasks > 0 ? Math.round((completedOnboardingTasks / totalOnboardingTasks) * 100) : 0}% complete
              </div>
            </div>

            <div className="space-y-3 mt-6">
              <h3 className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">Tasks</h3>
              {filteredTasks.map((task) => (
                <div key={task.id} className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-elevated)]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {task.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-[var(--status-hired-text)]" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400 dark:text-[var(--text-disabled)]" />
                        )}
                        <h4 className="font-medium dark:text-[var(--text-primary)]">{task.title}</h4>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1 ml-7">{task.description}</p>
                      )}
                      {task.isCompleted && task.completedAt && (
                        <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1 ml-7">
                          Completed: {formatDateTime(task.completedAt)}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        task.isCompleted
                          ? 'bg-green-100 text-green-700 dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)]'
                          : 'bg-gray-100 text-gray-600 dark:bg-[var(--bg-elevated)] dark:text-[var(--text-tertiary)]'
                      }
                    >
                      {task.isCompleted ? 'Completed' : 'Pending'}
                    </Badge>
                  </div>
                  {task.taskType === 'SIGNATURE' && task.isCompleted && task.uploadUrl && (
                    <div className="mt-4 ml-7 p-4 bg-gray-50 dark:bg-[var(--bg-input)] rounded-lg">
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-2">Digital Signature:</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={task.uploadUrl}
                        alt="Signature"
                        className="max-w-md border border-gray-300 dark:border-[var(--border-subtle)] rounded bg-white dark:bg-[var(--bg-elevated)] p-2"
                      />
                    </div>
                  )}
                  {task.taskType === 'PACKAGE_UPLOAD' && task.isCompleted && task.uploadUrl && (
                    <div className="mt-4 ml-7 p-4 bg-gray-50 dark:bg-[var(--bg-input)] rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-green-600 dark:text-[var(--status-hired-text)]" />
                        <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Uploaded Package:</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">
                        Package uploaded and sent to administrator email
                      </p>
                    </div>
                  )}
                  {task.taskType === 'SOCIAL_SECURITY_DOCUMENT' && task.isCompleted && (
                    <div className="mt-4 ml-7 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2 dark:border-[var(--border-subtle)]"
                        onClick={() => handleDownloadSsnTask(task.id)}
                      >
                        <Download className="w-4 h-4" />
                        Download Social Security card
                      </Button>
                      <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)] w-full">
                        Stored securely; handle per your data policy.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Documents */}
      <Card className="border-2 border-gray-200 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Onboarding Documents</CardTitle>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-1">Acknowledgment and fillable PDF completions</p>
        </CardHeader>
        <CardContent>
          {!rbtProfile.onboardingCompletions || rbtProfile.onboardingCompletions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)]">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-[var(--text-disabled)]" />
              <p className="text-sm">No onboarding documents completed yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rbtProfile.onboardingCompletions.map((completion) => (
                <div key={completion.id} className="border dark:border-[var(--border-subtle)] rounded-lg p-4 dark:bg-[var(--bg-elevated)]">
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
                        <h4 className="font-medium dark:text-[var(--text-primary)]">{completion.document.title}</h4>
                        <Badge variant="outline" className="ml-2 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">
                          {completion.document.type === 'ACKNOWLEDGMENT' ? 'Acknowledgment' : 'Fillable PDF'}
                        </Badge>
                      </div>
                      {completion.completedAt && (
                        <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-1 ml-7">
                          Completed: {formatDateTime(completion.completedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          completion.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700 dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)]'
                            : completion.status === 'IN_PROGRESS'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-[var(--status-warning-bg)] dark:text-[var(--status-warning-text)]'
                              : 'bg-gray-100 text-gray-600 dark:bg-[var(--bg-elevated)] dark:text-[var(--text-tertiary)]'
                        }
                      >
                        {completion.status === 'COMPLETED' ? 'Completed' : completion.status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                      </Badge>
                      {completion.status === 'COMPLETED' && (
                        <>
                          {completion.document.type === 'FILLABLE_PDF' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-2 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]"
                              onClick={() => handleDownloadCompletion(completion.id, completion.document.title)}
                            >
                              <Download className="w-4 h-4" />
                              Download PDF
                            </Button>
                          ) : (
                            completion.acknowledgmentJson &&
                            (completion.acknowledgmentJson as { signatureData?: string; typedName?: string }).signatureData != null && (
                              <div className="flex flex-col gap-2">
                                <div className="border dark:border-[var(--border-subtle)] rounded p-2 bg-gray-50 dark:bg-[var(--bg-input)]">
                                  <p className="text-xs text-gray-600 dark:text-[var(--text-tertiary)] mb-1">Signature:</p>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={(completion.acknowledgmentJson as { signatureData: string }).signatureData}
                                    alt="Signature"
                                    className="max-w-[200px] max-h-[80px] border rounded"
                                  />
                                </div>
                                {(completion.acknowledgmentJson as { typedName?: string }).typedName && (
                                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                                    Signed: {(completion.acknowledgmentJson as { typedName: string }).typedName}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </>
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
