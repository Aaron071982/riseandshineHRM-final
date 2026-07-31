'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CLIENT_BOROUGH_OPTIONS } from '@/lib/schedule-import/boroughOptions'
import type { ScheduleImportPreview } from '@/lib/schedule-import/persist'
import type { ScheduleDeriveResult } from '@/lib/schedule-import/deriveWeekly'
import { AlertTriangle, Check, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Upload', 'Match RBTs', 'Client boroughs', 'Preview & import']

type Candidate = {
  id: string
  firstName: string
  lastName: string
  artemisProviderName: string | null
}

export default function ScheduleImportWizardPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ScheduleImportPreview | null>(null)
  const [derived, setDerived] = useState<ScheduleDeriveResult | null>(null)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [confirmedMatches, setConfirmedMatches] = useState<Record<string, string>>({})
  const [clientBoroughs, setClientBoroughs] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<'REPLACE' | 'MERGE'>('REPLACE')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const uploadFile = async (file: File) => {
    setLoading(true)
    setError(null)
    setResultMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/schedule/import/preview', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      setFileName(data.fileName)
      setPreview(data.preview)
      setDerived(data.derived)
      setPeriodStart(data.preview.detectedDateRange.min ?? '')
      setPeriodEnd(data.preview.detectedDateRange.max ?? '')
      setClientBoroughs(data.preview.clientBoroughs)

      const matches: Record<string, string> = {}
      for (const p of data.preview.providers as ScheduleImportPreview['providers']) {
        if (p.match.matchStatus === 'MATCHED' && p.match.rbtProfileId) {
          matches[p.providerName] = p.match.rbtProfileId
        } else if (p.match.suggestedRbtProfileId && p.match.matchStatus === 'NEEDS_REVIEW') {
          // leave unconfirmed until user confirms
        }
      }
      setConfirmedMatches(matches)

      // Load RBT list for dropdowns
      const candRes = await fetch('/api/schedule/import/candidates')
      if (candRes.ok) {
        const candData = await candRes.json()
        setCandidates(candData.candidates ?? [])
      }

      setStep(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const unmatched = useMemo(() => {
    if (!preview) return []
    return preview.providers.filter((p) => !confirmedMatches[p.providerName])
  }, [preview, confirmedMatches])

  const unsetClients = useMemo(() => {
    return Object.entries(clientBoroughs).filter(([, b]) => !b || b === 'Unset')
  }, [clientBoroughs])

  const commit = async () => {
    if (!derived || !preview) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/schedule/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          periodStart,
          periodEnd,
          mode,
          confirmedMatches,
          clientBoroughs,
          derived,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Commit failed')
      setResultMsg(
        `Imported ${data.providerCount} therapists, ${data.slotCount} slots. ${data.manualPreserved} manual preserved. ${data.unsetClientCount} clients still Unset borough.`
      )
      setStep(3)
      setTimeout(() => router.push(`/schedule?periodStart=${periodStart}&periodEnd=${periodEnd}`), 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/schedule" className="text-sm text-[#0D9488] hover:underline">
            ← Schedule
          </Link>
          <h1 className="text-2xl font-bold mt-1">Import Artemis schedule</h1>
          <p className="text-sm text-gray-500 mt-1">
            Derive weekly slots from the session reconciliation report. Manual sessions are never
            overwritten.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              i === step
                ? 'bg-[#0D9488] text-white'
                : i < step
                  ? 'bg-teal-100 text-teal-900'
                  : 'bg-gray-100 text-gray-500'
            )}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}
      {resultMsg && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 flex items-center gap-2">
          <Check className="w-4 h-4" />
          {resultMsg}
        </div>
      )}

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload session reconciliation .xlsx</CardTitle>
          </CardHeader>
          <CardContent>
            <label
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer',
                'border-teal-300 hover:bg-teal-50/50'
              )}
            >
              <Upload className="w-8 h-8 text-[#0D9488]" />
              <span className="text-sm text-gray-600">Drop file or click to browse</span>
              <Input
                type="file"
                accept=".xlsx,.xls"
                className="max-w-xs"
                disabled={loading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadFile(f)
                }}
              />
              {loading && (
                <p className="text-sm text-[#0D9488] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Parsing…
                </p>
              )}
            </label>
          </CardContent>
        </Card>
      )}

      {step >= 1 && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Biweekly period</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>Period start</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>Period end</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <p className="text-xs text-gray-500">
              Detected from file: {preview.detectedDateRange.min} – {preview.detectedDateRange.max} ·{' '}
              {preview.stats.providerCount} providers · {preview.stats.slotCount} weekly slots
            </p>
          </CardContent>
        </Card>
      )}

      {step === 1 && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Match providers → RBT profiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unmatched.length > 0 && (
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {unmatched.length} provider{unmatched.length === 1 ? '' : 's'} still unmatched —
                confirm or leave out of import.
              </p>
            )}
            <div className="overflow-x-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Provider</th>
                    <th className="px-3 py-2 text-left">Slots</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">RBT match</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.providers.map((p) => {
                    const selected = confirmedMatches[p.providerName] ?? ''
                    const suggest =
                      p.match.rbtProfileId ?? p.match.suggestedRbtProfileId ?? ''
                    return (
                      <tr key={p.providerName} className="border-t">
                        <td className="px-3 py-2">
                          {p.providerName}
                          <span className="block text-xs text-gray-500">{p.role}</span>
                        </td>
                        <td className="px-3 py-2">{p.slotCount}</td>
                        <td className="px-3 py-2">{p.match.matchStatus}</td>
                        <td className="px-3 py-2">
                          <select
                            className="h-8 rounded border px-2 text-sm w-full max-w-xs"
                            value={selected || suggest}
                            onChange={(e) => {
                              const id = e.target.value
                              setConfirmedMatches((prev) => {
                                const next = { ...prev }
                                if (!id) delete next[p.providerName]
                                else next[p.providerName] = id
                                return next
                              })
                            }}
                          >
                            <option value="">— Skip —</option>
                            {candidates.length > 0
                              ? candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.firstName} {c.lastName}
                                  </option>
                                ))
                              : suggest && (
                                  <option value={suggest}>Suggested match</option>
                                )}
                          </select>
                          {!selected && p.match.matchStatus === 'MATCHED' && suggest && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#0D9488]"
                              onClick={() =>
                                setConfirmedMatches((prev) => ({
                                  ...prev,
                                  [p.providerName]: suggest,
                                }))
                              }
                            >
                              Confirm
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button className="bg-[#0D9488]" onClick={() => setStep(2)}>
                Continue to boroughs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Client boroughs (remembered)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Artemis has no borough data. Set once — future imports reuse these. Unset:{' '}
              {unsetClients.length}
            </p>
            <div className="overflow-x-auto rounded border max-h-96">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="px-3 py-2 text-left">Borough</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.clientNames.map((name) => (
                    <tr key={name} className="border-t">
                      <td className="px-3 py-2">{name}</td>
                      <td className="px-3 py-2">
                        <select
                          className="h-8 rounded border px-2"
                          value={clientBoroughs[name] ?? 'Unset'}
                          onChange={(e) =>
                            setClientBoroughs((prev) => ({ ...prev, [name]: e.target.value }))
                          }
                        >
                          {CLIENT_BOROUGH_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button className="bg-[#0D9488]" onClick={() => setStep(3)}>
                Continue to preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview &amp; import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={mode === 'REPLACE'}
                  onChange={() => setMode('REPLACE')}
                />
                REPLACE imported rows for this period (manual kept)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === 'MERGE'} onChange={() => setMode('MERGE')} />
                MERGE (add/update without removing prior Artemis rows)
              </label>
            </div>
            <p className="text-sm">
              Will import <strong>{Object.keys(confirmedMatches).length}</strong> matched therapists
              · period {periodStart} – {periodEnd} · {unsetClients.length} clients Unset
            </p>
            <div className="max-h-64 overflow-y-auto rounded border text-xs space-y-2 p-3">
              {preview.providers
                .filter((p) => confirmedMatches[p.providerName])
                .map((p) => (
                  <div key={p.providerName}>
                    <strong>{p.providerName}</strong> — {p.slots.length} slots
                    <ul className="ml-4 text-gray-600">
                      {p.slots.slice(0, 8).map((s, i) => (
                        <li key={i}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek]}{' '}
                          {s.startTime}–{s.endTime} w/ {s.clientName}
                        </li>
                      ))}
                      {p.slots.length > 8 && <li>… +{p.slots.length - 8} more</li>}
                    </ul>
                  </div>
                ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                className="bg-[#0D9488]"
                disabled={loading || Object.keys(confirmedMatches).length === 0}
                onClick={() => void commit()}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import schedule'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
