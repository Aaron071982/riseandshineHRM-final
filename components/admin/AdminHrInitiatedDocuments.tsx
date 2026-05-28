'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { ChevronDown, ChevronUp, FileText, Loader2, Send } from 'lucide-react'
import { LS54_EMPLOYER, LS54_SLUG, formatOvertimeRate, parseHourlyRate } from '@/lib/onboarding/ls54'

type HrTaskRow = {
  id: string
  documentType: string
  title: string
  stepNumber: number
  status: string
  hrFileUrl: string | null
  hrUploadedAt: string | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_HR: 'Pending HR',
  PENDING_BT: 'Sent to RBT',
  PENDING_HR_SIGNOFF: 'Awaiting HR review',
  COMPLETE: 'Complete',
}

export default function AdminHrInitiatedDocuments({ rbtProfileId }: { rbtProfileId: string }) {
  const { showToast } = useToast()
  const [tasks, setTasks] = useState<HrTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSlug, setExpandedSlug] = useState<string | null>(LS54_SLUG)
  const [hourlyRate, setHourlyRate] = useState('')
  const [sending, setSending] = useState(false)

  const overtimePreview = (() => {
    const h = parseHourlyRate(hourlyRate)
    return h != null ? `$${formatOvertimeRate(h)}/hr` : '—'
  })()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/hr-documents`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to load HR documents', 'error')
        return
      }
      setTasks(data.tasks ?? [])
    } catch {
      showToast('Failed to load HR documents', 'error')
    } finally {
      setLoading(false)
    }
  }, [rbtProfileId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING_HR')

  const sendLs54 = async (taskId: string) => {
    const h = parseHourlyRate(hourlyRate)
    if (!h) {
      showToast('Enter a valid employee hourly rate', 'error')
      return
    }
    setSending(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90000)
      const res = await fetch(
        `/api/admin/rbts/${rbtProfileId}/hr-documents/${taskId}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ employeeRateOfPay: hourlyRate }),
          signal: controller.signal,
        }
      )
      clearTimeout(timeout)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to send', 'error')
        return
      }
      if (data.emailWarning) {
        showToast(data.emailWarning, 'warning')
      } else {
        showToast('LS-54 sent to RBT — notification email delivered', 'success')
      }
      setHourlyRate('')
      await load()
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out — the server may still be processing. Refresh and check status.'
          : 'Failed to send'
      showToast(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          HR-Initiated Documents
        </CardTitle>
        <p className="text-sm text-gray-500">
          Prepare employer sections, then send to the RBT. Pending: {pendingTasks.length}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#e36f1e]" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-gray-500">No HR-initiated document tasks for this RBT.</p>
        ) : (
          tasks.map((task) => {
            const isLs54 = task.documentType === LS54_SLUG
            const expanded = expandedSlug === task.documentType
            return (
              <div
                key={task.id}
                className="border rounded-lg dark:border-[var(--border-subtle)] overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  onClick={() =>
                    setExpandedSlug(expanded ? null : task.documentType)
                  }
                >
                  <div>
                    <p className="font-medium">
                      Step {task.stepNumber}: {task.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {STATUS_LABEL[task.status] ?? task.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={
                        task.status === 'PENDING_HR'
                          ? 'border-amber-300 text-amber-800'
                          : task.status === 'PENDING_BT'
                            ? 'border-blue-300 text-blue-800'
                            : ''
                      }
                    >
                      {STATUS_LABEL[task.status] ?? task.status}
                    </Badge>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {expanded && isLs54 && (
                  <div className="px-4 pb-4 border-t dark:border-[var(--border-subtle)] space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
                    {task.status !== 'PENDING_HR' && task.hrFileUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `/api/admin/rbts/${rbtProfileId}/hr-documents/${task.id}/hr-file`,
                            '_blank'
                          )
                        }
                      >
                        Preview HR-prepared PDF
                      </Button>
                    )}

                    {task.status === 'PENDING_HR' ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 text-sm">
                          <div>
                            <span className="text-gray-500">Employer name</span>
                            <p className="font-medium">{LS54_EMPLOYER.employerName}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Phone</span>
                            <p className="font-medium">{LS54_EMPLOYER.phone}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-gray-500">Physical address</span>
                            <p className="font-medium">{LS54_EMPLOYER.physicalAddress}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Regular payday</span>
                            <p className="font-medium">{LS54_EMPLOYER.regularPayday}</p>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
                          <div className="space-y-2">
                            <Label htmlFor="ls54-rate">Employee rate of pay ($/hr)</Label>
                            <Input
                              id="ls54-rate"
                              type="text"
                              inputMode="decimal"
                              placeholder="e.g. 22.00"
                              value={hourlyRate}
                              onChange={(e) => setHourlyRate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Overtime rate (1.5×)</Label>
                            <Input
                              readOnly
                              value={overtimePreview}
                              className="bg-gray-100 dark:bg-[var(--bg-input)]"
                            />
                          </div>
                        </div>

                        <Button
                          className="bg-[#e36f1e] hover:bg-[#c85f18]"
                          disabled={sending}
                          onClick={() => sendLs54(task.id)}
                        >
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          Send to RBT
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">
                        {task.status === 'PENDING_BT'
                          ? 'Waiting for the RBT to download, sign, and upload.'
                          : 'This document is in progress or complete.'}
                      </p>
                    )}
                  </div>
                )}

                {expanded && !isLs54 && (
                  <div className="px-4 pb-4 border-t text-sm text-gray-500">
                    HR preparation for this form is not configured in the admin UI yet.
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
