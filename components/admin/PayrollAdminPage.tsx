'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Loader2, Upload, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { usd, fmtUtcDate } from '@/lib/payroll/format'
import { cn } from '@/lib/utils'

type RunListItem = {
  id: string
  label: string
  payDate: string
  employeeCount: number
  totalNetPay: number
  totalGrossPay: number
  status: 'DRAFT' | 'PUBLISHED'
  sourceFileName: string | null
}

type Entry = {
  id: string
  payrollName: string
  matchStatus: 'MATCHED' | 'NEEDS_REVIEW' | 'UNMATCHED'
  matchConfidence: number
  totalHours: number
  grossPay: number
  netPay: number
  empTaxTotal: number
  employerTaxTotal: number
  totalPayrollCost: number
  rbtProfileId: string | null
  rbtProfile: { id: string; firstName: string; lastName: string; email: string | null } | null
}

type Candidate = { id: string; name: string }

type RunDetail = RunListItem & {
  periodStart: string
  periodEnd: string
  entries: Entry[]
}

function statusBadge(status: string) {
  if (status === 'PUBLISHED') return <Badge className="bg-green-600">Published</Badge>
  if (status === 'MATCHED') return <Badge className="bg-green-600">Matched</Badge>
  if (status === 'NEEDS_REVIEW') return <Badge className="bg-amber-500">Needs review</Badge>
  if (status === 'UNMATCHED') return <Badge variant="destructive">Unmatched</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

export default function PayrollAdminPage() {
  const { showToast } = useToast()
  const [runs, setRuns] = useState<RunListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [run, setRun] = useState<RunDetail | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [publishing, setPublishing] = useState(false)
  const [filter, setFilter] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    const res = await fetch('/api/admin/payroll/runs', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) setRuns(data.runs ?? [])
  }, [])

  const loadRun = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/payroll/runs/${id}`, { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(data.error || 'Failed to load run', 'error')
      return
    }
    setRun(data.run)
    setCandidates(data.candidates ?? [])
    setActiveRunId(id)
  }, [showToast])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await loadRuns()
      setLoading(false)
    })()
  }, [loadRuns])

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/payroll/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Upload failed', 'error')
        return
      }
      showToast(
        `Found ${data.preview.employeeCount} employees · ${data.preview.periodLabel} · net ${usd(data.preview.totalNetPay)}`,
        'success'
      )
      await loadRuns()
      setRun({ ...data.run, entries: data.entries })
      setCandidates(data.candidates ?? [])
      setActiveRunId(data.run.id)
    } finally {
      setUploading(false)
    }
  }

  const confirmMatch = async (entryId: string, rbtProfileId: string | null) => {
    if (!activeRunId) return
    const res = await fetch(`/api/admin/payroll/runs/${activeRunId}/confirm-match`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId, rbtProfileId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(data.error || 'Match failed', 'error')
      return
    }
    setRun((prev) =>
      prev
        ? {
            ...prev,
            entries: prev.entries.map((e) => (e.id === entryId ? data.entry : e)),
          }
        : prev
    )
    showToast('Match saved', 'success')
  }

  const renameRun = async (id: string, currentLabel: string) => {
    const next = window.prompt('Rename payroll run', currentLabel)?.trim()
    if (!next || next === currentLabel) return
    setRenamingId(id)
    try {
      const res = await fetch(`/api/admin/payroll/runs/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Rename failed', 'error')
        return
      }
      setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, label: data.run.label } : r)))
      setRun((prev) => (prev && prev.id === id ? { ...prev, label: data.run.label } : prev))
      showToast('Renamed', 'success')
    } finally {
      setRenamingId(null)
    }
  }

  const deleteRun = async (id: string, label: string) => {
    const ok = window.confirm(
      `Delete payroll run “${label}”? This removes all stubs for this run and cannot be undone.`
    )
    if (!ok) return
    const res = await fetch(`/api/admin/payroll/runs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(data.error || 'Delete failed', 'error')
      return
    }
    showToast('Payroll run deleted', 'success')
    if (activeRunId === id) {
      setActiveRunId(null)
      setRun(null)
    }
    await loadRuns()
  }

  const publish = async (force = false) => {
    if (!activeRunId) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/admin/payroll/runs/${activeRunId}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.canForce) {
          const ok = window.confirm(
            `${data.unmatchedWithPay?.length ?? 0} unmatched employees still have pay. Publish anyway?`
          )
          if (ok) await publish(true)
          else showToast(data.error || 'Cannot publish', 'error')
        } else {
          showToast(data.error || 'Cannot publish', 'error')
        }
        return
      }
      showToast('Payroll published — employees can see their stubs', 'success')
      await loadRuns()
      await loadRun(activeRunId)
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#0E4D52]" />
      </div>
    )
  }

  if (activeRunId && run) {
    const filtered = run.entries.filter((e) => {
      if (!filter.trim()) return true
      const q = filter.toLowerCase()
      const profile = e.rbtProfile ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}` : ''
      return e.payrollName.toLowerCase().includes(q) || profile.toLowerCase().includes(q)
    })

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2"
              onClick={() => {
                setActiveRunId(null)
                setRun(null)
              }}
            >
              <ArrowLeft className="w-4 h-4" /> All payroll runs
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{run.label}</h1>
            <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
              <span>Pay date {fmtUtcDate(run.payDate)} · {run.employeeCount} employees ·</span>
              {statusBadge(run.status)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={renamingId === run.id}
              onClick={() => void renameRun(run.id, run.label)}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Rename
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => void deleteRun(run.id, run.label)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            {run.status === 'DRAFT' && (
              <Button
                className="bg-[#0E4D52] hover:bg-[#0A3A3E]"
                disabled={publishing}
                onClick={() => void publish(false)}
              >
                {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Publish payroll run
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500">Total gross</div>
              <div className="text-lg font-semibold">{usd(run.totalGrossPay)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500">Total net</div>
              <div className="text-lg font-semibold">{usd(run.totalNetPay)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500">Employer taxes (admin)</div>
              <div className="text-lg font-semibold">
                {usd(run.entries.reduce((s, e) => s + e.employerTaxTotal, 0))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500">Payroll cost (admin)</div>
              <div className="text-lg font-semibold">
                {usd(run.entries.reduce((s, e) => s + e.totalPayrollCost, 0))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Input
          placeholder="Search payroll or HRM name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Payroll name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">HRM profile</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-right">Employer tax</th>
                <th className="px-3 py-2 text-right">Payroll cost</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{e.payrollName}</td>
                  <td className="px-3 py-2">{statusBadge(e.matchStatus)}</td>
                  <td className="px-3 py-2 min-w-[14rem]">
                    {run.status === 'DRAFT' ? (
                      <select
                        className="w-full border rounded-md px-2 py-1.5 text-sm"
                        value={e.rbtProfileId ?? ''}
                        onChange={(ev) =>
                          void confirmMatch(e.id, ev.target.value ? ev.target.value : null)
                        }
                      >
                        <option value="">— Unmatched —</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : e.rbtProfile ? (
                      `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(e.grossPay)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{usd(e.netPay)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                    {usd(e.employerTaxTotal)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                    {usd(e.totalPayrollCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload finished payroll registers and publish employee pay stubs.
          </p>
        </div>
        <label
          className={cn(
            'inline-flex items-center gap-2 rounded-md bg-[#0E4D52] text-white px-4 py-2 text-sm font-medium cursor-pointer hover:bg-[#0A3A3E]',
            uploading && 'opacity-60 pointer-events-none'
          )}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload payroll register
          <input
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onUpload(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            No payroll runs yet. Upload a .xls register to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Pay date</th>
                <th className="px-3 py-2">Employees</th>
                <th className="px-3 py-2 text-right">Total net</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.label}</td>
                  <td className="px-3 py-2">{fmtUtcDate(r.payDate)}</td>
                  <td className="px-3 py-2">{r.employeeCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(r.totalNetPay)}</td>
                  <td className="px-3 py-2">{statusBadge(r.status)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => void loadRun(r.id)}>
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={renamingId === r.id}
                        title="Rename"
                        onClick={() => void renameRun(r.id, r.label)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                        onClick={() => void deleteRun(r.id, r.label)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
