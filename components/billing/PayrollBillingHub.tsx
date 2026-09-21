'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { formatUsd, formatHours, defaultBiweeklyPeriod } from '@/lib/billing/format'
import { PAYROLL_THEME as T } from '@/lib/payroll/theme'
import {
  generateAllPayStubsForPeriodAction,
  generatePayStubAction,
  getPayStatementLinesAction,
  importRbtFromArtemisAction,
  saveBcbaHoursSheetAction,
  sendAllPayStubsForPeriodAction,
  sendPayStubAction,
  upsertPayPeriodAction,
} from '@/lib/payroll/actions'
import { hoursBetween, amountForHours, round2 } from '@/lib/payroll/hoursHmm'
import type {
  UnifiedDashboardData,
  UnifiedPayeeRow,
} from '@/lib/payroll/loadUnifiedDashboard'
import {
  PayoutTrendChart,
  HoursDistributionChart,
} from '@/components/billing/BillingDashboardCharts'
import RecentCyclesList from '@/components/billing/RecentCyclesList'
import { CycleStatusBadge } from '@/components/billing/MatchStatusBadge'

const DEFERRED_MSG =
  'Generate the stub PDF before downloading or sending'

function Money({
  value,
  className,
  size = 'md',
}: {
  value: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span
      className={cn(
        'font-display tabular-nums',
        size === 'lg' && 'text-3xl sm:text-4xl font-bold tracking-tight',
        size === 'md' && 'text-xl font-semibold',
        size === 'sm' && 'text-sm font-semibold',
        className
      )}
      style={{ color: T.money }}
    >
      {formatUsd(value)}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'SENT'
      ? 'bg-[#2E6B57]/12 text-[#2E6B57]'
      : status === 'READY'
        ? 'bg-[#E7692C]/12 text-[#E7692C]'
        : 'bg-[#2A2019]/08 text-[#2A2019]/70'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize',
        tone
      )}
    >
      {status.toLowerCase()}
    </span>
  )
}

function ClassificationPill({
  classification,
}: {
  classification: '1099' | 'W2'
}) {
  const isW2 = classification === 'W2'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        isW2
          ? 'bg-[#2E6B57]/12 text-[#2E6B57]'
          : 'bg-[#E7692C]/12 text-[#E7692C]'
      )}
    >
      {isW2 ? 'W-2' : '1099'}
    </span>
  )
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: T.espresso }}
      aria-hidden
    >
      {letters}
    </span>
  )
}

function ReconcileWarn() {
  return (
    <span
      className="inline-flex items-center text-amber-700"
      title="Totals don't match line items — review"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span className="sr-only">Totals don&apos;t match line items — review</span>
    </span>
  )
}

export default function PayrollBillingHub({ data }: { data: UnifiedDashboardData }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const tab = searchParams.get('tab') ?? 'payroll'
  const segment = (searchParams.get('segment') as 'BCBA' | 'RBT') || 'BCBA'

  const [bcbaOpen, setBcbaOpen] = useState(false)
  const [editRow, setEditRow] = useState<UnifiedPayeeRow | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)

  const selectedPeriod =
    data.periods.find((p) => p.id === data.selectedPeriodId) ?? null

  const visible = useMemo(
    () => data.statements.filter((s) => s.payeeType === segment),
    [data.statements, segment]
  )

  const totals = useMemo(() => {
    const hours = visible.reduce((a, s) => a + s.totalHours, 0)
    const gross = visible.reduce((a, s) => a + s.grossPay, 0)
    return { count: visible.length, hours, gross }
  }, [visible])

  function setQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') params.delete(k)
      else params.set(k, v)
    }
    router.push(`/billing?${params.toString()}`)
  }

  function generateStub(row: UnifiedPayeeRow) {
    startTransition(async () => {
      const res = await generatePayStubAction({
        payStatementId: row.statementId,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      showToast('Pay stub generated (Ready)', 'success')
      router.refresh()
    })
  }

  function sendStub(row: UnifiedPayeeRow) {
    startTransition(async () => {
      const res = await sendPayStubAction({
        payStatementId: row.statementId,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      showToast(
        row.payeeType === 'BCBA'
          ? 'Sent — now visible in the BCBA portal'
          : 'Sent — now visible in the RBT portal Pay page',
        'success'
      )
      router.refresh()
    })
  }

  function downloadStub(row: UnifiedPayeeRow) {
    if (row.status === 'DRAFT') {
      showToast(DEFERRED_MSG, 'warning')
      return
    }
    window.location.href = `/api/payroll/statements/${row.statementId}/download`
  }

  function exportCsv() {
    if (!selectedPeriod) {
      showToast('Select or create a pay period first', 'warning')
      return
    }
    const header = [
      'payeeType',
      'payee',
      'entity',
      'rate',
      'hours',
      'gross',
      'net',
      'status',
      'reconciled',
    ]
    const lines = data.statements.map((s) =>
      [
        s.payeeType,
        JSON.stringify(s.payeeName),
        JSON.stringify(s.entityName ?? ''),
        s.ratePerHour ?? '',
        s.totalHours,
        s.grossPay,
        s.netPay,
        s.status,
        s.reconciled,
      ].join(',')
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${selectedPeriod.label.replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function generateAllStubs() {
    if (!selectedPeriod) {
      showToast('Select or create a pay period first', 'warning')
      return
    }
    startTransition(async () => {
      const res = await generateAllPayStubsForPeriodAction({
        payPeriodId: selectedPeriod.id,
        payeeType: segment,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      const errNote =
        res.errors.length > 0
          ? ` · ${res.errors.length} failed (${res.errors[0]?.name}: ${res.errors[0]?.error})`
          : ''
      showToast(
        `Generated ${res.generated} stub(s)${res.skipped ? ` · ${res.skipped} skipped` : ''}${errNote}`,
        res.errors.length ? 'warning' : 'success'
      )
      router.refresh()
    })
  }

  async function sendAllToPortal() {
    if (!selectedPeriod) {
      showToast('Select or create a pay period first', 'warning')
      return
    }
    startTransition(async () => {
      const res = await sendAllPayStubsForPeriodAction({
        payPeriodId: selectedPeriod.id,
        payeeType: segment,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      const errNote =
        res.errors.length > 0
          ? ` · ${res.errors.length} failed (${res.errors[0]?.name}: ${res.errors[0]?.error})`
          : ''
      showToast(
        segment === 'BCBA'
          ? `Sent ${res.sent} stub(s) to the portal${res.skipped ? ` · ${res.skipped} skipped` : ''}${errNote}`
          : `Marked ${res.sent} stub(s) Sent${res.skipped ? ` · ${res.skipped} skipped` : ''}${errNote}`,
        res.errors.length ? 'warning' : 'success'
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-6" style={{ color: T.espresso }}>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Payroll &amp; Billing
          </h1>
          <p className="mt-1 text-sm" style={{ color: T.muted }}>
            Unified BCBA (1099 or W-2) and RBT payroll for the selected period
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="pay-period">
            Pay period
          </label>
          <select
            id="pay-period"
            className="h-10 rounded-md border bg-white px-3 text-sm min-w-[180px]"
            style={{ borderColor: T.border }}
            value={data.selectedPeriodId ?? ''}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                setPeriodOpen(true)
                return
              }
              setQuery({ period: e.target.value || null })
            }}
          >
            {data.periods.length === 0 && (
              <option value="">No periods yet</option>
            )}
            {data.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="__new__">+ New pay period…</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="border-[rgba(42,32,25,0.18)]"
            onClick={exportCsv}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[rgba(42,32,25,0.18)]"
            disabled={pending || !selectedPeriod}
            onClick={generateAllStubs}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            )}
            Generate stubs
          </Button>
          <Button
            type="button"
            className="text-white shadow-sm"
            style={{ backgroundColor: T.orange }}
            disabled={pending || !selectedPeriod}
            onClick={sendAllToPortal}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = T.orangeHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = T.orange
            }}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Send to portal
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setQuery({ tab: v })}
        className="space-y-5"
      >
        <TabsList
          className="h-11 w-full sm:w-auto justify-start bg-[#2A2019]/06 p-1"
        >
          {(['payroll', 'billing', 'stubs'] as const).map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="px-4 data-[state=active]:bg-white data-[state=active]:text-[#2A2019] data-[state=active]:shadow-sm"
            >
              {key === 'payroll'
                ? 'Payroll'
                : key === 'billing'
                  ? 'Billing'
                  : 'Pay stubs'}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="payroll" className="space-y-5 mt-0">
          {/* Summary strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {(
              [
                ['Gross payroll', data.summary.grossPayroll],
                ['RBT payroll', data.summary.rbtPayroll],
                ['BCBA payroll', data.summary.bcbaPayroll],
                ['Billed · Plutus', data.summary.billedPlutus],
                ['Est. margin', data.summary.estMargin],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border px-4 py-4"
                style={{
                  backgroundColor: T.white,
                  borderColor: T.border,
                }}
              >
                <p
                  className="text-[11px] font-medium uppercase tracking-wide"
                  style={{ color: T.muted }}
                >
                  {label}
                </p>
                <div className="mt-2">
                  <Money value={value} size="lg" />
                </div>
              </div>
            ))}
          </div>
          {data.summary.billedSource === 'hours-fallback' && (
            <p className="text-xs" style={{ color: T.muted }}>
              Plutus billed estimated from statement hours × NY Medicaid CPT rates
              (no overlapping billing sessions).
            </p>
          )}

          {/* Segment + actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div
              className="inline-flex rounded-lg p-1"
              style={{ backgroundColor: 'rgba(42,32,25,0.06)' }}
            >
              {(
                [
                  ['BCBA', 'BCBA — hours sheet'],
                  ['RBT', 'RBT — reconciliation'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setQuery({ segment: key })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    segment === key
                      ? 'bg-white shadow-sm'
                      : 'text-[#2A2019]/60 hover:text-[#2A2019]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {segment === 'BCBA' ? (
                <Button
                  type="button"
                  className="text-white"
                  style={{ backgroundColor: T.orange }}
                  onClick={() => {
                    setEditRow(null)
                    setBcbaOpen(true)
                  }}
                  disabled={!selectedPeriod}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Enter hours sheet
                </Button>
              ) : (
                <Button
                  type="button"
                  className="text-white"
                  style={{ backgroundColor: T.orange }}
                  onClick={() => setImportOpen(true)}
                  disabled={!selectedPeriod}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  Import from reconciliation
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div
            className="overflow-x-auto rounded-xl border bg-white"
            style={{ borderColor: T.border }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] uppercase tracking-wide"
                  style={{
                    backgroundColor: T.surface,
                    color: T.muted,
                  }}
                >
                  <th className="px-4 py-3 font-medium">Payee</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium text-right">Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Hours</th>
                  <th className="px-4 py-3 font-medium text-right">Gross</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm"
                      style={{ color: T.muted }}
                    >
                      {selectedPeriod
                        ? segment === 'BCBA'
                          ? 'No BCBA statements yet. Open the hours sheet to enter days for this pay cycle.'
                          : 'No RBT statements yet. Import from the Artemis reconciliation sheet.'
                        : 'Create a pay period to get started.'}
                    </td>
                  </tr>
                )}
                {visible.map((row) => (
                  <tr
                    key={row.statementId}
                    className="border-t"
                    style={{ borderColor: T.border }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Initials name={row.payeeName} />
                        <div className="min-w-0">
                          <span className="font-medium">{row.payeeName}</span>
                          <div className="mt-0.5">
                            <ClassificationPill
                              classification={row.classification}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: T.muted }}>
                      {row.entityName || '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.ratePerHour != null
                        ? formatUsd(row.ratePerHour)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-1">
                        {formatHours(row.totalHours)}
                        {!row.reconciled && <ReconcileWarn />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Money value={row.grossPay} size="sm" />
                        {!row.reconciled && <ReconcileWarn />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          className="text-xs font-medium underline-offset-2 hover:underline"
                          onClick={() => {
                            setEditRow(row)
                            setBcbaOpen(true)
                          }}
                          disabled={row.payeeType !== 'BCBA'}
                          title={
                            row.payeeType === 'BCBA'
                              ? 'Edit hours'
                              : 'RBT lines come from reconciliation import'
                          }
                        >
                          Edit
                        </button>
                        <span style={{ color: T.border }}>·</span>
                        <button
                          type="button"
                          className="text-xs font-medium underline-offset-2 hover:underline"
                          onClick={() => generateStub(row)}
                          disabled={pending || row.status === 'SENT'}
                          title={
                            row.status === 'SENT'
                              ? 'Already sent'
                              : 'Generate PDF stub'
                          }
                        >
                          Generate stub
                        </button>
                        <span style={{ color: T.border }}>·</span>
                        <button
                          type="button"
                          className="text-xs font-medium underline-offset-2 hover:underline"
                          onClick={() => sendStub(row)}
                          disabled={pending || row.status === 'SENT'}
                          title={
                            row.status === 'SENT'
                              ? 'Already sent'
                              : 'Publish to portal (BCBA) / mark Sent'
                          }
                        >
                          Send
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {visible.length > 0 && (
                <tfoot>
                  <tr
                    className="border-t text-sm font-medium"
                    style={{
                      borderColor: T.border,
                      backgroundColor: T.surface,
                    }}
                  >
                    <td className="px-4 py-3" colSpan={2}>
                      {totals.count}{' '}
                      {segment === 'BCBA' ? 'contractor' : 'RBT'}
                      {totals.count === 1 ? '' : 's'}
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatHours(totals.hours)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money value={totals.gross} size="sm" />
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 mt-0">
          <BillingTabPanel data={data} />
        </TabsContent>

        <TabsContent value="stubs" className="mt-0">
          <PayStubsPanel
            statements={data.statements}
            onDownload={downloadStub}
            onSend={sendStub}
            pending={pending}
          />
        </TabsContent>
      </Tabs>

      <BcbaHoursSheetDialog
        open={bcbaOpen}
        onOpenChange={setBcbaOpen}
        period={selectedPeriod}
        candidates={data.bcbaCandidates}
        editRow={editRow}
        onDone={() => {
          setBcbaOpen(false)
          setEditRow(null)
          router.refresh()
        }}
      />

      <RbtImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        periodId={selectedPeriod?.id ?? null}
        onDone={() => {
          setImportOpen(false)
          router.refresh()
        }}
      />

      <NewPeriodDialog
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        onCreated={(id) => {
          setPeriodOpen(false)
          setQuery({ period: id })
          router.refresh()
        }}
      />
    </div>
  )
}

function BillingTabPanel({ data }: { data: UnifiedDashboardData }) {
  const b = data.billing
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Artemis billing cycles</h2>
          <p className="text-sm mt-0.5" style={{ color: T.muted }}>
            CPT session reconciliation · NY Medicaid rate card preserved
          </p>
        </div>
        <Button
          asChild
          className="text-white"
          style={{ backgroundColor: T.orange }}
        >
          <Link href="/billing/cycles/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Start new cycle
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Total cycles', String(b.totalCycles)],
          [
            'Last cycle payout',
            formatUsd(
              b.cycles.find((c) => c.status === 'FINALIZED' || c.status === 'PAID')
                ?.totalGrossPay ?? 0
            ),
          ],
          ['Missing pay rates', String(b.missingRatesCount)],
          [
            'Latest cycle BTs',
            b.latestCycle ? String(b.latestCycle.rbtCount) : '—',
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border bg-white px-4 py-4"
            style={{ borderColor: T.border }}
          >
            <p
              className="text-[11px] font-medium uppercase tracking-wide"
              style={{ color: T.muted }}
            >
              {label}
            </p>
            <p
              className={cn(
                'mt-2 font-display text-2xl font-bold tabular-nums',
                label.includes('payout') && 'text-[#2E6B57]'
              )}
              style={
                label.includes('payout')
                  ? { color: T.money }
                  : { color: T.espresso }
              }
            >
              {value}
            </p>
            {label === 'Missing pay rates' && b.missingRatesCount > 0 && (
              <Link
                href="/billing/rates"
                className="text-xs mt-1 inline-block"
                style={{ color: T.orange }}
              >
                Set rates →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-xl border bg-white p-4"
          style={{ borderColor: T.border }}
        >
          <p className="text-sm font-semibold mb-3">Payout trend (last 6)</p>
          <PayoutTrendChart data={b.payoutTrend} />
        </div>
        <div
          className="rounded-xl border bg-white p-4"
          style={{ borderColor: T.border }}
        >
          <p className="text-sm font-semibold mb-3">Hours by top BTs — current cycle</p>
          <HoursDistributionChart data={b.topBtHours} />
        </div>
      </div>

      {b.latestCycle && (
        <div
          className="rounded-xl border bg-white px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ borderColor: T.border }}
        >
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-wide"
              style={{ color: T.muted }}
            >
              Current cycle
            </p>
            <p className="font-display text-xl font-semibold mt-1">
              {b.latestCycle.label}
            </p>
            <div className="mt-2">
              <CycleStatusBadge status={b.latestCycle.status as never} />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {b.latestCycle.rbtCount}
              </p>
              <p className="text-xs" style={{ color: T.muted }}>
                BTs
              </p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {b.latestCycle.totalHours.toFixed(1)}
              </p>
              <p className="text-xs" style={{ color: T.muted }}>
                Hours
              </p>
            </div>
            <div>
              <Money value={b.latestCycle.totalGrossPay} size="md" />
              <p className="text-xs" style={{ color: T.muted }}>
                Gross
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={`/billing/cycles/${b.latestCycle.id}`}>View cycle</Link>
          </Button>
        </div>
      )}

      <div
        className="rounded-xl border bg-white overflow-hidden"
        style={{ borderColor: T.border }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: T.border }}>
          <p className="font-semibold">Recent cycles</p>
        </div>
        <RecentCyclesList cycles={b.cycles as never} />
      </div>
    </div>
  )
}

function PayStubsPanel({
  statements,
  onDownload,
  onSend,
  pending,
}: {
  statements: UnifiedPayeeRow[]
  onDownload: (row: UnifiedPayeeRow) => void
  onSend: (row: UnifiedPayeeRow) => void
  pending: boolean
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl border bg-white"
      style={{ borderColor: T.border }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-left text-[11px] uppercase tracking-wide"
            style={{ backgroundColor: T.surface, color: T.muted }}
          >
            <th className="px-4 py-3 font-medium">Payee</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Net pay</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {statements.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center"
                style={{ color: T.muted }}
              >
                No statements for this period yet.
              </td>
            </tr>
          )}
          {statements.map((s) => (
            <tr
              key={s.statementId}
              className="border-t"
              style={{ borderColor: T.border }}
            >
              <td className="px-4 py-3 font-medium">{s.payeeName}</td>
              <td className="px-4 py-3" style={{ color: T.muted }}>
                {s.payeeType}
              </td>
              <td className="px-4 py-3 text-right">
                <Money value={s.netPay} size="sm" />
              </td>
              <td className="px-4 py-3">
                <StatusPill status={s.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  className="text-xs font-medium underline-offset-2 hover:underline mr-2"
                  onClick={() => onDownload(s)}
                  disabled={pending || s.status === 'DRAFT'}
                  title={
                    s.status === 'DRAFT'
                      ? 'Generate stub first'
                      : 'Download PDF'
                  }
                >
                  Download
                </button>
                <button
                  type="button"
                  className="text-xs font-medium underline-offset-2 hover:underline"
                  onClick={() => onSend(s)}
                  disabled={pending || s.status === 'SENT'}
                  title={
                    s.status === 'SENT' ? 'Already sent' : 'Mark Sent / publish'
                  }
                >
                  Send
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type SheetRow = {
  key: string
  workDate: string
  startClock: string
  endClock: string
}

function blankSheetRows(periodStart: string, count = 5): SheetRow[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `new-${i}-${Math.random().toString(36).slice(2, 8)}`,
    workDate: i === 0 ? periodStart : '',
    startClock: '',
    endClock: '',
  }))
}

function BcbaHoursSheetDialog({
  open,
  onOpenChange,
  period,
  candidates,
  editRow,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  period: UnifiedDashboardData['periods'][number] | null
  candidates: UnifiedDashboardData['bcbaCandidates']
  editRow: UnifiedPayeeRow | null
  onDone: () => void
}) {
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [loadingLines, setLoadingLines] = useState(false)
  const [userId, setUserId] = useState('')
  const [legalName, setLegalName] = useState('')
  const [entityName, setEntityName] = useState('')
  const [classification, setClassification] = useState<'1099' | 'W2'>('1099')
  const [rate, setRate] = useState('')
  const [rows, setRows] = useState<SheetRow[]>([])

  useEffect(() => {
    if (!open || !period) return

    const periodStart = period.startDate
    let cancelled = false

    async function init() {
      const match = editRow?.userId
        ? candidates.find((c) => c.userId === editRow.userId)
        : candidates[0]

      const uid = editRow?.userId ?? match?.userId ?? ''
      const cand = candidates.find((c) => c.userId === uid) ?? match

      setUserId(uid)
      setLegalName(
        editRow?.payeeName ||
          cand?.legalName ||
          cand?.name ||
          ''
      )
      setEntityName(editRow?.entityName || cand?.entityName || '')
      setClassification(
        editRow?.classification || cand?.classification || '1099'
      )
      setRate(
        editRow?.ratePerHour != null
          ? String(editRow.ratePerHour)
          : cand?.ratePerHour != null
            ? String(cand.ratePerHour)
            : ''
      )

      if (editRow?.statementId) {
        setLoadingLines(true)
        const res = await getPayStatementLinesAction({
          payStatementId: editRow.statementId,
        })
        if (cancelled) return
        setLoadingLines(false)
        if (res.ok && res.lines.length > 0) {
          setRows(
            res.lines.map((l) => ({
              key: l.id,
              workDate: l.workDate,
              startClock: l.startClock,
              endClock: l.endClock,
            }))
          )
          return
        }
      }

      if (!cancelled) {
        setRows(blankSheetRows(periodStart))
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [open, period, editRow, candidates])

  function selectCandidate(nextUserId: string) {
    setUserId(nextUserId)
    const c = candidates.find((x) => x.userId === nextUserId)
    if (!c) return
    setLegalName(c.legalName || c.name)
    setEntityName(c.entityName || '')
    setClassification(c.classification || '1099')
    if (c.ratePerHour != null) setRate(String(c.ratePerHour))
  }

  function updateRow(key: string, patch: Partial<SheetRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    )
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Math.random().toString(36).slice(2, 9)}`,
        workDate: period?.startDate ?? '',
        startClock: '',
        endClock: '',
      },
    ])
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  const rateNum = Number(rate) || 0
  const preview = useMemo(() => {
    let hours = 0
    let gross = 0
    for (const r of rows) {
      if (!r.startClock.trim() || !r.endClock.trim()) continue
      const h = hoursBetween(r.startClock, r.endClock)
      hours = round2(hours + h)
      gross = round2(gross + amountForHours(h, rateNum))
    }
    return { hours, gross }
  }, [rows, rateNum])

  function submit() {
    if (!period) {
      showToast('Select a pay period first', 'error')
      return
    }
    if (!userId) {
      showToast('Select a BCBA', 'error')
      return
    }
    if (!(rateNum > 0)) {
      showToast('Enter a rate per hour', 'error')
      return
    }
    const filled = rows.filter(
      (r) => r.workDate && r.startClock.trim() && r.endClock.trim()
    )
    if (filled.length === 0) {
      showToast('Add at least one day with start and end times', 'error')
      return
    }

    startTransition(async () => {
      const res = await saveBcbaHoursSheetAction({
        payPeriodId: period.id,
        userId,
        legalName: legalName.trim() || 'BCBA',
        entityName: entityName.trim() || null,
        classification,
        ratePerHour: rateNum,
        lines: filled.map((r) => ({
          workDate: r.workDate,
          startClock: r.startClock,
          endClock: r.endClock,
        })),
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      showToast(
        `Saved ${res.lineCount} day(s) · ${formatHours(res.totalHours)} · ${formatUsd(res.grossPay)}`,
        'success'
      )
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-[#FAF8F4]">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editRow ? 'Edit BCBA hours sheet' : 'BCBA hours sheet'}
          </DialogTitle>
          {period ? (
            <p className="text-sm" style={{ color: T.muted }}>
              Pay cycle {period.label} ({period.startDate} → {period.endDate})
            </p>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>BCBA</Label>
              {candidates.length > 0 ? (
                <select
                  className="w-full h-10 rounded-md border bg-white px-3 text-sm"
                  value={userId}
                  disabled={Boolean(editRow)}
                  onChange={(e) => selectCandidate(e.target.value)}
                >
                  <option value="">Select BCBA…</option>
                  {candidates.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name}
                      {c.email ? ` · ${c.email}` : ''}
                      {c.ratePerHour != null
                        ? ` · ${formatUsd(c.ratePerHour)}/h`
                        : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-amber-800">
                  No BCBA portal users found. Add a BCBA under Admin → Employees
                  first so they have a login.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Legal name on stub</Label>
              <Input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Entity (optional)</Label>
              <Input
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="My Lane Applied Behavior Analysis PLLC"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tax classification</Label>
              <div
                className="inline-flex rounded-lg border bg-white p-0.5"
                role="tablist"
                aria-label="Tax classification"
              >
                {(
                  [
                    {
                      id: '1099' as const,
                      label: '1099',
                      hint: 'Contractor — no taxes withheld',
                    },
                    {
                      id: 'W2' as const,
                      label: 'W-2',
                      hint: 'Employee — taxes estimated on stub',
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={classification === opt.id}
                    onClick={() => setClassification(opt.id)}
                    className={cn(
                      'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                      classification === opt.id
                        ? 'bg-[#2A2019] text-white'
                        : 'text-[#2A2019]/70 hover:bg-[#2A2019]/06'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs" style={{ color: T.muted }}>
                {classification === 'W2'
                  ? 'W-2 stubs withhold estimated federal, FICA, and NY State taxes when generated (or use register amounts when available).'
                  : '1099 stubs pay gross with no employee tax withholdings.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Rate / hour</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>

          <div
            className="overflow-x-auto rounded-lg border bg-white"
            style={{ borderColor: T.border }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] uppercase tracking-wide"
                  style={{ backgroundColor: T.surface, color: T.muted }}
                >
                  <th className="px-3 py-2 font-medium">Work date</th>
                  <th className="px-3 py-2 font-medium">Start (h.mm)</th>
                  <th className="px-3 py-2 font-medium">End (h.mm)</th>
                  <th className="px-3 py-2 font-medium text-right">Hours</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {loadingLines ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center"
                      style={{ color: T.muted }}
                    >
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Loading days…
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const h =
                      r.startClock.trim() && r.endClock.trim()
                        ? hoursBetween(r.startClock, r.endClock)
                        : 0
                    const amt = amountForHours(h, rateNum)
                    return (
                      <tr
                        key={r.key}
                        className="border-t"
                        style={{ borderColor: T.border }}
                      >
                        <td className="px-2 py-1.5">
                          <Input
                            type="date"
                            className="h-9"
                            value={r.workDate}
                            min={period?.startDate}
                            max={period?.endDate}
                            onChange={(e) =>
                              updateRow(r.key, { workDate: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-9"
                            value={r.startClock}
                            placeholder="9.00"
                            onChange={(e) =>
                              updateRow(r.key, { startClock: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-9"
                            value={r.endClock}
                            placeholder="12.00"
                            onChange={(e) =>
                              updateRow(r.key, { endClock: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {h > 0 ? formatHours(h) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {h > 0 && rateNum > 0 ? formatUsd(amt) : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-black/5"
                            onClick={() => removeRow(r.key)}
                            aria-label="Remove day"
                          >
                            <Trash2 className="h-3.5 w-3.5 opacity-60" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr
                  className="border-t text-sm font-medium"
                  style={{ borderColor: T.border, backgroundColor: T.surface }}
                >
                  <td className="px-3 py-2" colSpan={3}>
                    Period total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatHours(preview.hours)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={preview.gross} size="sm" />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add day
            </Button>
            <p className="text-xs" style={{ color: T.muted }}>
              .30 = 30 minutes (not decimal). Example: 4.30 → 6.30 = 2.00 h
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="text-white"
            style={{ backgroundColor: T.orange }}
            disabled={pending || loadingLines || candidates.length === 0}
            onClick={submit}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save hours sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RbtImportDialog({
  open,
  onOpenChange,
  periodId,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  periodId: string | null
  onDone: () => void
}) {
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [fileName, setFileName] = useState<string | null>(null)
  const [base64, setBase64] = useState<string | null>(null)

  function onFile(file: File | null) {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const b64 = result.includes(',') ? result.split(',')[1] : result
      setBase64(b64)
    }
    reader.readAsDataURL(file)
  }

  function submit() {
    if (!periodId || !base64) {
      showToast('Choose a period and workbook', 'error')
      return
    }
    startTransition(async () => {
      const res = await importRbtFromArtemisAction({
        payPeriodId: periodId,
        workbookBase64: base64,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      const unmatched =
        res.unmatchedProviders.length > 0
          ? ` · ${res.unmatchedProviders.length} unmatched`
          : ''
      showToast(
        `Imported ${res.statementsCreated + res.statementsUpdated} statements · ${res.lineItemsCreated} lines${unmatched}`,
        'success'
      )
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#FAF8F4]">
        <DialogHeader>
          <DialogTitle className="font-display">
            Import RBT reconciliation
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm" style={{ color: T.muted }}>
            Upload the Artemis Session Reconciliation workbook. Uses the same
            parser as billing cycles.
          </p>
          <label
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 cursor-pointer bg-white"
            style={{ borderColor: T.border }}
          >
            <FileSpreadsheet className="h-8 w-8" style={{ color: T.orange }} />
            <span className="text-sm font-medium">
              {fileName ?? 'Choose .xlsx file'}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="text-white"
            style={{ backgroundColor: T.orange }}
            disabled={pending || !base64}
            onClick={submit}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewPeriodDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (id: string) => void
}) {
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const defaults = defaultBiweeklyPeriod()
  const [startDate, setStartDate] = useState(
    defaults.periodStart.toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState(
    defaults.periodEnd.toISOString().slice(0, 10)
  )
  const [payDate, setPayDate] = useState(
    defaults.periodEnd.toISOString().slice(0, 10)
  )
  const [label, setLabel] = useState('')

  function submit() {
    startTransition(async () => {
      const autoLabel =
        label.trim() ||
        `${startDate} – ${endDate}`
      const res = await upsertPayPeriodAction({
        startDate,
        endDate,
        payDate,
        label: autoLabel,
      })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      showToast('Pay period saved', 'success')
      onCreated(res.payPeriodId)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#FAF8F4]">
        <DialogHeader>
          <DialogTitle className="font-display">New pay period</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional — defaults to date range"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pay date</Label>
            <Input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="text-white"
            style={{ backgroundColor: T.orange }}
            disabled={pending}
            onClick={submit}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
