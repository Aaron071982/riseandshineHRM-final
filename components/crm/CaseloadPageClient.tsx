'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import CaseloadTable, { type CaseloadRow } from '@/components/crm/CaseloadTable'
import { AddClientForm } from '@/components/crm/AddClientForm'

export default function CaseloadPageClient({
  canCreate,
}: {
  canCreate: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stage = searchParams.get('stage')
  const queue = searchParams.get('queue')
  const initialGroup = searchParams.get('group') || 'all'
  const initialDept = searchParams.get('dept')

  const [rows, setRows] = useState<CaseloadRow[]>([])
  const [group, setGroup] = useState(initialGroup)
  const [dept, setDept] = useState<string | null>(initialDept)
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(
    searchParams.get('attention') === '1'
  )
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pending, startTransition] = useTransition()

  const syncUrl = useCallback(
    (opts: {
      q?: string
      group?: string
      dept?: string | null
      attention?: boolean
    }) => {
      const params = new URLSearchParams()
      const nextQ = opts.q ?? q
      const nextGroup = opts.group ?? group
      const nextDept = opts.dept !== undefined ? opts.dept : dept
      const nextAttention =
        opts.attention !== undefined ? opts.attention : needsAttentionOnly

      if (nextQ) params.set('q', nextQ)
      if (stage) params.set('stage', stage)
      if (queue) params.set('queue', queue)
      if (nextDept) params.set('dept', nextDept)
      else if (nextGroup && nextGroup !== 'all' && !stage && !queue) {
        params.set('group', nextGroup)
      }
      if (nextAttention) params.set('attention', '1')

      const qs = params.toString()
      router.replace(`/client-services/clients${qs ? `?${qs}` : ''}`, {
        scroll: false,
      })
    },
    [dept, group, needsAttentionOnly, q, queue, router, stage]
  )

  const load = useCallback(
    (opts?: { q?: string; group?: string; dept?: string | null }) => {
      startTransition(async () => {
        setError('')
        const params = new URLSearchParams()
        const query = opts?.q ?? q
        const g = opts?.group ?? group
        const d = opts?.dept !== undefined ? opts.dept : dept
        if (query) params.set('q', query)
        if (stage) params.set('stage', stage)
        if (queue) params.set('queue', queue)
        if (d) params.set('dept', d)
        else if (g && g !== 'all' && !stage && !queue) params.set('group', g)

        const res = await fetch(`/api/client-services/clients?${params}`, {
          credentials: 'include',
        })
        if (res.status === 401) {
          setError('Session expired — refresh to re-verify')
          return
        }
        if (!res.ok) {
          setError('Failed to load caseload')
          return
        }
        const data = await res.json()
        setRows(
          (data.clients ?? []).map(
            (c: CaseloadRow & Record<string, unknown>) => ({
              id: c.id,
              clientCode: c.clientCode,
              firstName: c.firstName,
              lastName: c.lastName,
              stage: c.stage,
              pipelineStatus: c.pipelineStatus,
              currentOwnerDept: c.currentOwnerDept,
              nextAction: c.nextAction,
              nextActionDueAt: c.nextActionDueAt
                ? String(c.nextActionDueAt)
                : null,
              daysInStage: c.daysInStage ?? 0,
              stalled: !!c.stalled,
              needsAttention: !!c.needsAttention,
              actionOverdue: !!c.actionOverdue,
              blocked: !!c.blocked,
              missingDocs: !!c.missingDocs,
              hasUnresolvedAlerts: !!c.hasUnresolvedAlerts,
              rbtName: c.rbtName,
              rbtProfileId: c.rbtProfileId,
              authExpirationDate: c.authExpirationDate
                ? String(c.authExpirationDate)
                : null,
              scheduledHoursPerWeek:
                typeof c.scheduledHoursPerWeek === 'number'
                  ? c.scheduledHoursPerWeek
                  : null,
              authHours: typeof c.authHours === 'number' ? c.authHours : null,
              insuranceProvider:
                typeof c.insuranceProvider === 'string'
                  ? c.insuranceProvider
                  : null,
            })
          )
        )
      })
    },
    [dept, group, q, queue, stage]
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onSearch = (e: Event) => {
      const detail = (e as CustomEvent<{ q: string }>).detail
      if (detail?.q != null) {
        setQ(detail.q)
        load({ q: detail.q })
        syncUrl({ q: detail.q })
      }
    }
    window.addEventListener('cs-global-search', onSearch)
    return () => window.removeEventListener('cs-global-search', onSearch)
  }, [load, syncUrl])

  const clearFilters = () => {
    setGroup('all')
    setDept(null)
    setQ('')
    setNeedsAttentionOnly(false)
    router.push('/client-services/clients')
    load({ q: '', group: 'all', dept: null })
  }

  const onExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (stage) params.set('stage', stage)
      if (queue) params.set('queue', queue)
      if (dept) params.set('dept', dept)
      else if (group && group !== 'all' && !stage && !queue) {
        params.set('group', group)
      }
      const res = await fetch(
        `/api/client-services/clients/export?${params}`,
        { credentials: 'include' }
      )
      if (!res.ok) {
        setError('Export failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ||
        'caseload.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Caseload
          </h1>
          <p className="mt-0.5 text-sm text-quiet">
            Grouped by stage — owner, next action, and attention signals at a
            glance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/client-services"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm text-ink hover:bg-line-2"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm text-ink hover:bg-line-2 disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export clients'}
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2"
            >
              Add client
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <CaseloadTable
        rows={rows}
        stageFilter={stage}
        queueFilter={queue}
        groupFilter={group}
        deptFilter={dept}
        onGroupChange={(g) => {
          setGroup(g)
          setDept(null)
          if (stage || queue) {
            router.push(`/client-services/clients?group=${g}`)
          } else {
            load({ group: g, dept: null })
            syncUrl({ group: g, dept: null })
          }
        }}
        onDeptChange={(d) => {
          setDept(d)
          load({ dept: d })
          syncUrl({ dept: d })
        }}
        needsAttentionOnly={needsAttentionOnly}
        onNeedsAttentionChange={(on) => {
          setNeedsAttentionOnly(on)
          syncUrl({ attention: on })
        }}
        q={q}
        onClear={clearFilters}
      />

      {pending && (
        <p className="text-xs text-quiet">Refreshing caseload…</p>
      )}

      <AddClientForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
