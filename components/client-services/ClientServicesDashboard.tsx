'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutGrid,
  List,
  Upload,
  Link2,
  Plus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NY_BOROUGHS } from '@/lib/client-services/constants'
import { toClientRow, type ApiCaseloadClient, type ClientRow } from '@/lib/clients/viewModel'
import { STATUS, type CaseStatus } from '@/lib/clients/status'
import AddressAutocomplete, {
  type StructuredAddress,
} from '@/components/ui/AddressAutocomplete'
import ClientsTable from '@/components/clients/ClientsTable'
import ClientAvatar from '@/components/clients/ClientAvatar'
import StatusBadge from '@/components/clients/StatusBadge'
import HoursBar from '@/components/clients/HoursBar'
import BreakCountdown from '@/components/client-services/BreakCountdown'
import CaseloadSummaryBoard, {
  type SummaryMetric,
  type SummaryRange,
} from '@/components/client-services/CaseloadSummaryBoard'

type Alerts = {
  needsRbt: number
  needsAdditionalHours: number
  clientsOnBreak: number
  receivingServices?: number
  unlinkedScheduleClients: number
  clientsNotLinkedToSchedule?: number
}

type SummaryFilter = 'all' | 'needs_rbt' | 'needs_hours' | 'on_break' | 'receiving'

const VIEW_KEY = 'cs_view_mode'

export default function ClientServicesDashboard({ canImport }: { canImport: boolean }) {
  const router = useRouter()
  const [view, setView] = useState<'board' | 'list'>('list')
  const [alerts, setAlerts] = useState<Alerts | null>(null)
  const [summaryBoard, setSummaryBoard] = useState<SummaryMetric[]>([])
  const [summaryRange, setSummaryRange] = useState<SummaryRange>('30')
  const [apiClients, setApiClients] = useState<ApiCaseloadClient[]>([])
  const [totals, setTotals] = useState(0)
  const [unlinked, setUnlinked] = useState<{ clientName: string; assignmentCount: number }[]>([])
  const [schedulePeriodLabel, setSchedulePeriodLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [summary, setSummary] = useState<SummaryFilter>('all')
  const [importMsg, setImportMsg] = useState('')
  const [linkMsg, setLinkMsg] = useState('')
  const [pending, startTransition] = useTransition()
  const [showLinkPanel, setShowLinkPanel] = useState(false)
  const [showAddClient, setShowAddClient] = useState(false)
  const [linkTarget, setLinkTarget] = useState<Record<string, string>>({})
  const [allClientsForLink, setAllClientsForLink] = useState<
    { id: string; firstName: string; lastName: string; clientCode: string }[]
  >([])

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY)
    if (saved === 'list' || saved === 'board') setView(saved)
    else setView('list')
  }, [])

  useEffect(() => {
    const onSearch = (e: Event) => {
      const detail = (e as CustomEvent<{ q: string }>).detail
      if (detail?.q != null) {
        setQ(detail.q)
        load(detail.q)
      }
    }
    window.addEventListener('cs-global-search', onSearch)
    return () => window.removeEventListener('cs-global-search', onSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setViewPersist = (v: 'board' | 'list') => {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  const load = (query = q, range = summaryRange) => {
    startTransition(async () => {
      setError('')
      try {
        const params = new URLSearchParams()
        if (query) params.set('q', query)
        const dashParams = new URLSearchParams({ range })

        const [dashRes, listRes] = await Promise.all([
          fetch(`/api/client-services/dashboard?${dashParams}`, { credentials: 'include' }),
          fetch(`/api/client-services/clients?${params}`, { credentials: 'include' }),
        ])

        if (dashRes.status === 401 || listRes.status === 401) {
          setError('Session expired — refresh to re-verify')
          return
        }
        if (!dashRes.ok || !listRes.ok) {
          setError('Failed to load client data')
          return
        }
        const dash = await dashRes.json()
        const list = await listRes.json()
        setAlerts(dash.alerts)
        setSummaryBoard(dash.summaryBoard?.metrics ?? [])
        setTotals(dash.totals?.clients ?? list.clients?.length ?? 0)
        setApiClients(list.clients ?? [])
        setUnlinked(list.unlinkedScheduleClients ?? dash.unlinkedScheduleClients ?? [])
        setSchedulePeriodLabel(
          dash.schedulePeriod?.label ?? list.schedulePeriod?.label ?? ''
        )
      } catch {
        setError('Failed to load')
      } finally {
        setLoading(false)
      }
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSummaryRangeChange = (r: SummaryRange) => {
    setSummaryRange(r)
    load(q, r)
  }

  const rows: ClientRow[] = useMemo(
    () => apiClients.map((c) => toClientRow(c)),
    [apiClients]
  )

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      if (summary === 'all') return true
      if (summary === 'needs_rbt') return !!c.needsRbt || c.status === 'needs_rbt'
      if (summary === 'needs_hours') return !!c.needsAdditionalHours
      if (summary === 'on_break') return !!c.onBreak
      if (summary === 'receiving') return !!c.receivingServices || c.status === 'receiving'
      return true
    })
  }, [rows, summary])

  const receivingCount = useMemo(
    () => rows.filter((c) => c.receivingServices || c.status === 'receiving').length,
    [rows]
  )
  const onBreakCount = useMemo(() => rows.filter((c) => c.onBreak).length, [rows])
  const clientsNotLinked =
    alerts?.clientsNotLinkedToSchedule ??
    rows.filter((c) => c.status === 'unmatched').length

  const onImport = async (file: File | null) => {
    if (!file) return
    setImportMsg('Importing…')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/client-services/import', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setImportMsg(data.error || 'Import failed')
      return
    }
    setImportMsg(`Imported ${data.created ?? 0} new, updated ${data.updated ?? 0}`)
    load()
  }

  const openLinks = async () => {
    setShowLinkPanel(true)
    const res = await fetch('/api/client-services/schedule-links', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setUnlinked(data.unlinked ?? [])
      setAllClientsForLink(data.clients ?? [])
    }
  }

  const resolveLinks = async () => {
    setLinkMsg('Resolving…')
    const res = await fetch('/api/client-services/schedule-links', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve-all' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setLinkMsg(data.error || 'Resolve failed')
      return
    }
    setLinkMsg(`Linked ${data.linked ?? 0} assignment(s)`)
    load()
    openLinks()
  }

  const linkName = async (scheduleClientName: string, serviceClientId: string) => {
    const res = await fetch('/api/client-services/schedule-links', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link', scheduleClientName, serviceClientId }),
    })
    if (!res.ok) {
      setLinkMsg('Link failed')
      return
    }
    setLinkMsg(`Linked ${scheduleClientName}`)
    load()
    openLinks()
  }

  const chips: {
    key: SummaryFilter
    label: string
    count: number
    status?: CaseStatus
  }[] = [
    {
      key: 'needs_rbt',
      label: 'Need an RBT',
      count: alerts?.needsRbt ?? 0,
      status: 'needs_rbt',
    },
    {
      key: 'needs_hours',
      label: 'Need hours',
      count: alerts?.needsAdditionalHours ?? 0,
      status: 'unmatched',
    },
    {
      key: 'on_break',
      label: 'On break',
      count: onBreakCount || alerts?.clientsOnBreak || 0,
      status: 'intake',
    },
    {
      key: 'receiving',
      label: 'Receiving',
      count: receivingCount || alerts?.receivingServices || 0,
      status: 'receiving',
    },
    { key: 'all', label: 'All', count: totals },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              background: 'linear-gradient(90deg, var(--sunrise-a), var(--sunrise-b))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Caseload overview
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold text-ink sm:text-[1.75rem]">
            Clients
          </h1>
          <p className="mt-1.5 text-sm text-quiet">
            {totals} client{totals === 1 ? '' : 's'} in scope
            {schedulePeriodLabel ? ` · Schedule period ${schedulePeriodLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canImport && (
            <button
              type="button"
              onClick={openLinks}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-quiet hover:bg-line-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              <Link2 className="h-3.5 w-3.5" />
              Links
              {unlinked.length > 0 && (
                <span className="text-sem-amber">({unlinked.length})</span>
              )}
            </button>
          )}
          {canImport && (
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onImport(e.target.files?.[0] ?? null)}
              />
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-quiet hover:bg-line-2">
                <Upload className="h-3.5 w-3.5" />
                Import CSV
              </span>
            </label>
          )}
          {canImport && (
            <button
              type="button"
              onClick={() => setShowAddClient(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              <Plus className="h-4 w-4" />
              Add client
            </button>
          )}
        </div>
      </div>

      {(clientsNotLinked > 0 || unlinked.length > 0) && (
        <div className="rounded-xl border border-line border-l-4 border-l-sem-amber bg-surface px-4 py-3 text-sm text-ink">
          <span style={{ color: 'var(--amber)' }}>
            {clientsNotLinked > 0 && (
              <>
                {clientsNotLinked} client{clientsNotLinked === 1 ? " isn't" : "s aren't"} linked to
                a schedule entry
              </>
            )}
            {clientsNotLinked > 0 && unlinked.length > 0 && ', and '}
            {unlinked.length > 0 && (
              <>
                {unlinked.length} schedule name{unlinked.length === 1 ? '' : 's'} couldn&apos;t be
                matched
              </>
            )}
            .
          </span>{' '}
          <button
            type="button"
            onClick={openLinks}
            className="font-medium text-brand hover:text-brand-2"
          >
            Review matches →
          </button>
        </div>
      )}

      {showAddClient && canImport && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onCreated={(id) => {
            setShowAddClient(false)
            router.push(`/client-services/clients/${id}`)
          }}
        />
      )}

      {importMsg && <p className="text-sm text-quiet">{importMsg}</p>}

      {summaryBoard.length > 0 && (
        <CaseloadSummaryBoard
          range={summaryRange}
          onRangeChange={onSummaryRangeChange}
          metrics={summaryBoard}
        />
      )}
      {linkMsg && <p className="text-sm text-quiet">{linkMsg}</p>}

      {showLinkPanel && canImport && (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Schedule names not linked</h3>
              <p className="mt-0.5 text-xs text-quiet">
                Mismatches surface here so clients are never silently marked unserved.
              </p>
            </div>
            <button
              type="button"
              onClick={resolveLinks}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-2"
            >
              Auto-resolve matches
            </button>
          </div>
          {unlinked.length === 0 ? (
            <p className="text-sm text-quiet">All active schedule names are linked.</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {unlinked.map((u) => (
                <li
                  key={u.clientName}
                  className="flex flex-wrap items-center gap-2 text-sm text-ink"
                >
                  <span className="min-w-[160px] font-medium">
                    {u.clientName}{' '}
                    <span className="text-faint">({u.assignmentCount})</span>
                  </span>
                  <select
                    className="rounded-lg border border-line bg-[var(--bg)] px-2 py-1 text-xs"
                    value={linkTarget[u.clientName] ?? ''}
                    onChange={(e) =>
                      setLinkTarget((prev) => ({ ...prev, [u.clientName]: e.target.value }))
                    }
                  >
                    <option value="">Link to client…</option>
                    {(allClientsForLink.length
                      ? allClientsForLink
                      : apiClients.map((c) => ({
                          id: c.id,
                          firstName: c.firstName,
                          lastName: c.lastName,
                          clientCode: c.clientCode,
                        }))
                    ).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.lastName}, {c.firstName} ({c.clientCode})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-sm font-medium text-brand disabled:opacity-40"
                    disabled={!linkTarget[u.clientName]}
                    onClick={() =>
                      linkTarget[u.clientName] &&
                      linkName(u.clientName, linkTarget[u.clientName])
                    }
                  >
                    Link
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const active = summary === chip.key
          const muted = chip.count === 0 && chip.key !== 'all'
          const meta = chip.status ? STATUS[chip.status] : null
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setSummary(active && chip.key !== 'all' ? 'all' : chip.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-brand bg-surface text-ink ring-4 ring-[var(--brand-ring)]'
                  : 'border-line bg-surface text-quiet hover:border-[color-mix(in_srgb,var(--line)_60%,var(--brand))]',
                muted && 'opacity-45'
              )}
            >
              {meta && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: meta.dot }}
                  aria-hidden
                />
              )}
              {chip.label}
              <span className="tabular-nums text-faint">{chip.count}</span>
            </button>
          )
        })}

        <div className="ml-auto inline-flex rounded-lg border border-line bg-[var(--bg)] p-0.5">
          <button
            type="button"
            onClick={() => setViewPersist('board')}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm',
              view === 'board' ? 'bg-brand text-white' : 'text-quiet hover:text-ink'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            type="button"
            onClick={() => setViewPersist('list')}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm',
              view === 'list' ? 'bg-brand text-white' : 'text-quiet hover:text-ink'
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-urgent">{error}</p>}

      {view === 'list' ? (
        <ClientsTable
          rows={filtered}
          loading={loading || pending}
          filteredEmpty={!loading && filtered.length === 0}
          onClearFilter={() => setSummary('all')}
        />
      ) : loading || pending ? (
        <p className="text-sm text-quiet">Loading…</p>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {filtered.map((c) => (
            <ClientCard key={c.id} client={c} api={apiClients.find((a) => a.id === c.id)} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-quiet">
              No clients match this filter.{' '}
              <button type="button" className="text-brand" onClick={() => setSummary('all')}>
                Clear filter
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ClientCard({
  client: c,
  api,
}: {
  client: ClientRow
  api?: ApiCaseloadClient
}) {
  const meta = STATUS[c.status]
  return (
    <Link
      href={c.href}
      className={cn(
        'group flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-[color-mix(in_srgb,var(--line)_50%,var(--brand))]',
        c.status === 'on_hold' && 'opacity-55',
        meta.urgent && 'bg-[linear-gradient(180deg,var(--urgent-row),var(--surface)_42%)]'
      )}
    >
      <div className="flex items-start gap-3">
        <ClientAvatar name={c.name} status={c.status} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink">{c.name}</div>
          <div className="mt-0.5 truncate text-xs text-quiet">
            {[c.address || c.location, c.bcba ? `BCBA ${c.bcba}` : null].filter(Boolean).join(' · ') ||
              c.code}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <StatusBadge status={c.status} />
      </div>
      <div className="mt-3 text-sm">
        {c.behaviorTechs.length === 0 ? (
          <span className="font-medium text-urgent">No BT assigned</span>
        ) : (
          <span className="text-quiet">BT: {c.behaviorTechs.join(', ')}</span>
        )}
      </div>
      <div className="mt-3">
        {c.hours ? (
          <HoursBar scheduled={c.hours.scheduled} target={c.hours.target} />
        ) : (
          <span className="text-xs text-faint">—</span>
        )}
      </div>
      {(() => {
        const brk = api?.activeClientBreak as
          | {
              expectedReturnDate: string
              overdue: boolean
              daysUntilReturn: number
              daysOverdue: number
            }
          | null
          | undefined
        if (!brk) return null
        return (
          <div className="mt-3">
            <BreakCountdown
              label="On break"
              expectedReturnDate={brk.expectedReturnDate}
              overdue={brk.overdue}
              daysUntilReturn={brk.daysUntilReturn}
              daysOverdue={brk.daysOverdue}
            />
          </div>
        )
      })()}
      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-quiet">
        <span>
          Docs {c.docs.done}/{c.docs.total}
        </span>
        <span className="font-medium text-brand">View →</span>
      </div>
    </Link>
  )
}

function AddClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    clientCode: '',
    status: 'NEW',
    dateOfBirth: '',
    borough: '',
    addressLine: '',
    city: '',
    state: 'NY',
    zip: '',
    bcbaName: '',
    caseCoordinatorName: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    insuranceProvider: '',
    authHours: '',
    btNames: '',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/client-services/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clientCode: form.clientCode || undefined,
          authHours: form.authHours === '' ? null : Number(form.authHours),
          btNames: form.btNames,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to create client')
        return
      }
      onCreated(data.client.id)
    } finally {
      setBusy(false)
    }
  }

  const field = (
    label: string,
    key: keyof typeof form,
    opts?: { type?: string; placeholder?: string; required?: boolean }
  ) => (
    <label className="block text-xs font-medium text-quiet">
      {label}
      <input
        type={opts?.type || 'text'}
        required={opts?.required}
        placeholder={opts?.placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
      />
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink">Add client</h3>
            <p className="mt-0.5 text-xs text-faint">
              Creates a new record with a 9-document checklist
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint hover:bg-line-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3">
            {field('First name', 'firstName', { required: true })}
            {field('Last name', 'lastName', { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Client code', 'clientCode', { placeholder: 'Auto CC-XXX if blank' })}
            <label className="block text-xs font-medium text-quiet">
              Status
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink"
              >
                <option value="NEW">New</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
                <option value="DISCHARGED">Discharged</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Date of birth', 'dateOfBirth', { type: 'date' })}
            <label className="block text-xs font-medium text-quiet">
              Borough
              <select
                value={form.borough}
                onChange={(e) => setForm((f) => ({ ...f, borough: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink"
              >
                <option value="">Select…</option>
                {NY_BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <AddressAutocomplete
            id="add-client-modal-address"
            label="Search address"
            placeholder="Start typing an address..."
            onAddressSelect={(selected: StructuredAddress) =>
              setForm((f) => ({
                ...f,
                addressLine: selected.addressLine1,
                city: selected.city,
                state: selected.state || f.state,
                zip: selected.zipCode,
              }))
            }
          />
          {field('Street address', 'addressLine')}
          <div className="grid grid-cols-3 gap-3">
            {field('City', 'city')}
            {field('State', 'state')}
            {field('ZIP', 'zip')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('BCBA', 'bcbaName')}
            {field('Case coordinator', 'caseCoordinatorName')}
          </div>
          {field('Assigned BTs', 'btNames', { placeholder: 'Comma-separated' })}
          <div className="grid grid-cols-2 gap-3">
            {field('Parent name', 'parentName')}
            {field('Parent phone', 'parentPhone')}
          </div>
          {field('Parent email', 'parentEmail', { type: 'email' })}
          <div className="grid grid-cols-2 gap-3">
            {field('Insurance', 'insuranceProvider')}
            {field('Auth hours / week', 'authHours', { type: 'number' })}
          </div>
          {error && <p className="text-sm text-urgent">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-3 py-2 text-sm text-quiet"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
