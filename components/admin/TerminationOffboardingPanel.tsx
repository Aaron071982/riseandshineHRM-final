'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, FileText, Download } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { OFFBOARDING_TASK_LABELS } from '@/lib/termination/constants'
import { formatDateNY } from '@/lib/termination/dates'

type TerminationTask = {
  id: string
  type: string
  completed: boolean
  completedAt: string | null
  notes: string | null
}

type TerminationDoc = {
  id: string
  docType: string
  fileName: string | null
  contentHtml: string | null
  generatedAt: string
}

type TerminationRecord = {
  id: string
  status: string
  reason: string
  reasonNarrative: string | null
  terminationDate: string
  noticeDeadline: string
  noticeIssuedAt: string | null
  finalPayDate: string
  tasks: TerminationTask[]
  documents: TerminationDoc[]
}

interface TerminationOffboardingPanelProps {
  rbtProfileId: string
}

export default function TerminationOffboardingPanel({ rbtProfileId }: TerminationOffboardingPanelProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [termination, setTermination] = useState<TerminationRecord | null>(null)
  const [taskLoading, setTaskLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/termination`, { credentials: 'include' })
      const data = await res.json()
      setTermination(data.termination ?? null)
    } catch {
      setTermination(null)
    } finally {
      setLoading(false)
    }
  }, [rbtProfileId])

  useEffect(() => {
    load()
  }, [load])

  const toggleTask = async (task: TerminationTask) => {
    if (task.completed) return
    setTaskLoading(task.id)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/termination/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: 'Marked complete in HRM' }),
      })
      if (!res.ok) {
        showToast('Failed to update task', 'error')
        return
      }
      await load()
    } catch {
      showToast('Failed to update task', 'error')
    } finally {
      setTaskLoading(null)
    }
  }

  const downloadDoc = (doc: TerminationDoc) => {
    if (!doc.contentHtml) return
    const blob = new Blob([doc.contentHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.fileName || `${doc.docType}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  if (!termination) return null

  const completedCount = termination.tasks.filter((t) => t.completed).length
  const noticeOverdue = !termination.noticeIssuedAt && new Date() > new Date(termination.noticeDeadline)

  return (
    <div className="space-y-4">
      <Card className="border-red-200 dark:border-[var(--status-rejected-border)]">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base text-red-700 dark:text-[var(--status-rejected-text)]">
              Termination &amp; offboarding
            </CardTitle>
            <Badge variant={termination.status === 'COMPLETED' ? 'secondary' : 'destructive'}>
              {termination.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 text-sm">
          <p>
            <strong>Effective:</strong> {formatDateNY(termination.terminationDate)} ·{' '}
            <strong>Final pay:</strong> {formatDateNY(termination.finalPayDate)}
          </p>
          <p className={noticeOverdue ? 'text-red-600 font-medium' : ''}>
            <strong>§195(6) notice deadline:</strong> {formatDateNY(termination.noticeDeadline)}
            {termination.noticeIssuedAt
              ? ` · Issued ${formatDateNY(termination.noticeIssuedAt)}`
              : noticeOverdue
                ? ' · OVERDUE'
                : ' · Not yet issued'}
          </p>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)]">
            Offboarding: {completedCount}/{termination.tasks.length} tasks complete
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">Offboarding checklist</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {termination.tasks.map((task) => (
            <label
              key={task.id}
              className={`flex items-start gap-3 p-2 rounded-md border text-sm ${
                task.completed
                  ? 'bg-green-50 border-green-200 dark:bg-[var(--status-hired-bg)]'
                  : 'border-gray-200 dark:border-[var(--border-subtle)]'
              }`}
            >
              <Checkbox
                checked={task.completed}
                disabled={task.completed || taskLoading === task.id}
                onCheckedChange={() => toggleTask(task)}
                className="mt-0.5"
              />
              <span className="flex-1">
                {OFFBOARDING_TASK_LABELS[task.type] || task.type}
                {task.completed && task.notes && (
                  <span className="block text-xs text-gray-500 mt-0.5">{task.notes}</span>
                )}
              </span>
              {taskLoading === task.id && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Termination packet
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {termination.documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 text-sm py-1">
              <span>{doc.fileName || doc.docType}</span>
              {doc.contentHtml && (
                <Button size="sm" variant="outline" onClick={() => downloadDoc(doc)}>
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
