'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Upload } from 'lucide-react'
import { usd, fmtUtcDate } from '@/lib/payroll/format'
import type { YtdParsePreview } from '@/lib/payroll/ytd-preview-types'
import { cn } from '@/lib/utils'

type MappingRow = {
  payrollName: string
  rbtProfileId: string | null
  importUnmatched: boolean
  matchStatus: 'MATCHED' | 'NEEDS_REVIEW' | 'UNMATCHED'
  suggestedRbtProfileId: string | null
}

function statusBadge(status: string) {
  if (status === 'MATCHED') return <Badge className="bg-green-600">Matched</Badge>
  if (status === 'NEEDS_REVIEW') return <Badge className="bg-amber-500">Needs review</Badge>
  if (status === 'UNMATCHED') return <Badge variant="destructive">Unmatched</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

export default function PayrollYtdImportWizard({ backHref }: { backHref: string }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [step, setStep] = useState(1)
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<YtdParsePreview | null>(null)
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  const canNextFrom1 = !!preview && !preview.blockingError && preview.runs.length > 0
  const canNextFrom2 = canNextFrom1 && preview!.runs.every((r) => r.checksumOk)

  const summary = useMemo(() => {
    if (!preview) return null
    return {
      periods: preview.runs.length,
      employees: new Set(preview.nameMatches.map((n) => n.payrollName)).size,
      gross: preview.runs.reduce((s, r) => s + r.gross, 0),
      net: preview.runs.reduce((s, r) => s + r.net, 0),
    }
  }, [preview])

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length) return
    const picked = [...list].filter((f) => f.name.toLowerCase().endsWith('.xls'))
    if (picked.length === 0) {
      showToast('Only .xls (BIFF8) Year-to-Date exports are accepted', 'error')
      return
    }
    setFiles(picked)
    setParsing(true)
    setPreview(null)
    try {
      const fd = new FormData()
      for (const f of picked) fd.append('files', f)
      const res = await fetch('/api/admin/payroll/ytd/parse', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Parse failed', 'error')
        return
      }
      const p = data.preview as YtdParsePreview
      setPreview(p)
      setMappings(
        p.nameMatches.map((n) => ({
          payrollName: n.payrollName,
          // Auto-apply only MATCHED; pre-select suggestion for NEEDS_REVIEW without marking applied
          rbtProfileId:
            n.matchStatus === 'MATCHED'
              ? n.rbtProfileId
              : n.matchStatus === 'NEEDS_REVIEW'
                ? n.suggestedRbtProfileId
                : null,
          importUnmatched: false,
          matchStatus: n.matchStatus,
          suggestedRbtProfileId: n.suggestedRbtProfileId,
        }))
      )
      if (p.blockingError) showToast(p.blockingError, 'error')
      else showToast(`Parsed ${p.snapshots.filter((s) => s.ok).length} snapshots`, 'success')
    } finally {
      setParsing(false)
    }
  }

  const updateMapping = (name: string, patch: Partial<MappingRow>) => {
    setMappings((prev) =>
      prev.map((m) => (m.payrollName === name ? { ...m, ...patch } : m))
    )
  }

  const onImport = async () => {
    if (!preview || !files.length) return
    setImporting(true)
    try {
      const fd = new FormData()
      for (const f of files) fd.append('files', f)
      fd.append(
        'mappings',
        JSON.stringify(
          mappings.map((m) => ({
            payrollName: m.payrollName,
            rbtProfileId: m.importUnmatched ? null : m.rbtProfileId,
            importUnmatched: m.importUnmatched || !m.rbtProfileId,
          }))
        )
      )
      const res = await fetch('/api/admin/payroll/ytd/import', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Import failed', 'error')
        return
      }
      showToast(`Imported ${data.periodCount} payroll runs`, 'success')
      router.push(backHref)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href={backHref}
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Payroll
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Upload YTD reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Back-fill Jan–Apr periods by differencing cumulative Year-to-Date exports.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[1, 2, 3, 4].map((n) => (
          <Badge
            key={n}
            variant={step === n ? 'default' : 'secondary'}
            className={cn(step === n && 'bg-[#0E4D52]')}
          >
            Step {n}
            {n === 1 ? ' · Files' : n === 2 ? ' · Periods' : n === 3 ? ' · Names' : ' · Confirm'}
          </Badge>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <label
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-6 py-12 cursor-pointer hover:bg-gray-50',
                parsing && 'opacity-60 pointer-events-none'
              )}
            >
              {parsing ? (
                <Loader2 className="w-8 h-8 animate-spin text-[#0E4D52]" />
              ) : (
                <Upload className="w-8 h-8 text-[#0E4D52]" />
              )}
              <div className="text-center">
                <p className="font-medium">Drop Year-to-Date .xls files</p>
                <p className="text-sm text-gray-500">Multi-select · .xls only · dates read from sheet cells</p>
              </div>
              <input
                type="file"
                accept=".xls,application/vnd.ms-excel"
                multiple
                className="hidden"
                onChange={(e) => void onPickFiles(e.target.files)}
              />
            </label>

            {preview && (
              <>
                <p className="text-sm font-medium">Sorted by period end</p>
                {preview.overlaps.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3 space-y-1">
                    <p className="font-medium">Existing payroll coverage warning</p>
                    {preview.overlaps.map((o) => (
                      <p key={o}>{o}</p>
                    ))}
                  </div>
                )}
                {preview.blockingError && (
                  <div className="rounded-md border border-red-300 bg-red-50 text-red-800 text-sm p-3">
                    {preview.blockingError}
                  </div>
                )}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">File</th>
                        <th className="px-3 py-2">Period end</th>
                        <th className="px-3 py-2">Employees</th>
                        <th className="px-3 py-2 text-right">YTD gross</th>
                        <th className="px-3 py-2">Parsed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.snapshots.map((s) => (
                        <tr key={s.fileName} className="border-t">
                          <td className="px-3 py-2 font-medium">{s.fileName}</td>
                          <td className="px-3 py-2">
                            {s.periodEnd ? fmtUtcDate(s.periodEnd) : '—'}
                          </td>
                          <td className="px-3 py-2">{s.employeeCount}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{usd(s.ytdGross)}</td>
                          <td className="px-3 py-2">
                            {s.ok ? (
                              <Badge className="bg-green-600">✓</Badge>
                            ) : (
                              <Badge variant="destructive">✗ {s.error}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button
                className="bg-[#0E4D52] hover:bg-[#0A3A3E]"
                disabled={!canNextFrom1}
                onClick={() => setStep(2)}
              >
                Next: review periods
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && preview && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-gray-600">
              Each period is the delta between consecutive cumulative snapshots.
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Pay date</th>
                    <th className="px-3 py-2">Employees</th>
                    <th className="px-3 py-2 text-right">Δ Hours</th>
                    <th className="px-3 py-2 text-right">Δ Gross</th>
                    <th className="px-3 py-2 text-right">Δ Net</th>
                    <th className="px-3 py-2">Checksum</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.runs.map((r) => {
                    const open = expandedRun === r.label
                    return (
                      <Fragment key={r.label}>
                        <tr className="border-t">
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className="p-1"
                              onClick={() => setExpandedRun(open ? null : r.label)}
                            >
                              {open ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 font-medium">{r.label}</td>
                          <td className="px-3 py-2">{fmtUtcDate(r.payDate)}</td>
                          <td className="px-3 py-2">{r.employeeCount}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.values}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{usd(r.gross)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{usd(r.net)}</td>
                          <td className="px-3 py-2">
                            {r.checksumOk ? (
                              <Badge className="bg-green-600">OK</Badge>
                            ) : (
                              <Badge variant="destructive">Fail</Badge>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-t bg-gray-50">
                            <td colSpan={8} className="px-4 py-3">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 text-left">
                                    <th className="py-1">Name</th>
                                    <th className="py-1 text-right">Hours</th>
                                    <th className="py-1 text-right">Gross</th>
                                    <th className="py-1 text-right">Net</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.entries.map((e) => (
                                    <tr key={e.rawName}>
                                      <td className="py-1">
                                        {e.rawName}
                                        {e.isContractor ? ' (1099)' : ''}
                                      </td>
                                      <td className="py-1 text-right tabular-nums">{e.totalHours}</td>
                                      <td className="py-1 text-right tabular-nums">{usd(e.totalGross)}</td>
                                      <td className="py-1 text-right tabular-nums">{usd(e.netPay)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="bg-[#0E4D52] hover:bg-[#0A3A3E]"
                disabled={!canNextFrom2}
                onClick={() => setStep(3)}
              >
                Next: name matching
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && preview && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-gray-600">
              Resolve each payroll name once for the whole batch. Confirming writes{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">payrollName</code> on the HRM
              profile.
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Payroll name</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">HRM profile</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.payrollName} className="border-t">
                      <td className="px-3 py-2 font-medium">{m.payrollName}</td>
                      <td className="px-3 py-2">{statusBadge(m.matchStatus)}</td>
                      <td className="px-3 py-2 min-w-[18rem]">
                        <select
                          className="w-full border rounded-md px-2 py-1.5 text-sm"
                          value={
                            m.importUnmatched
                              ? '__unmatched__'
                              : m.rbtProfileId ?? ''
                          }
                          onChange={(ev) => {
                            const v = ev.target.value
                            if (v === '__unmatched__') {
                              updateMapping(m.payrollName, {
                                importUnmatched: true,
                                rbtProfileId: null,
                              })
                            } else if (!v) {
                              updateMapping(m.payrollName, {
                                importUnmatched: false,
                                rbtProfileId: null,
                              })
                            } else {
                              updateMapping(m.payrollName, {
                                importUnmatched: false,
                                rbtProfileId: v,
                              })
                            }
                          }}
                        >
                          <option value="">— Choose profile —</option>
                          <option value="__unmatched__">
                            Not an employee / contractor — import unmatched
                          </option>
                          {preview.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button className="bg-[#0E4D52] hover:bg-[#0A3A3E]" onClick={() => setStep(4)}>
                Next: confirm
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && preview && summary && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-950 text-sm p-3">
              These runs are back-filled from cumulative YTD reports. Per-period amounts are derived
              by subtraction, not read from the source.
            </div>
            <ul className="text-sm space-y-1">
              <li>
                <strong>{summary.periods}</strong> periods
              </li>
              <li>
                <strong>{summary.employees}</strong> distinct payroll names
              </li>
              <li>
                Total gross <strong>{usd(summary.gross)}</strong>
              </li>
              <li>
                Total net <strong>{usd(summary.net)}</strong>
              </li>
            </ul>
            <p className="text-xs text-gray-500">
              Runs are created as DRAFT with source YTD_SNAPSHOT. Publish them from the payroll list
              when ready.
            </p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} disabled={importing}>
                Back
              </Button>
              <Button
                className="bg-[#0E4D52] hover:bg-[#0A3A3E]"
                disabled={importing}
                onClick={() => void onImport()}
              >
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirm &amp; import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
