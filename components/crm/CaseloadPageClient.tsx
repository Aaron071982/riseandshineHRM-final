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

  const [rows, setRows] = useState<CaseloadRow[]>([])
  const [group, setGroup] = useState(initialGroup)
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pending, startTransition] = useTransition()

  const load = useCallback(
    (opts?: { q?: string; group?: string }) => {
      startTransition(async () => {
        setError('')
        const params = new URLSearchParams()
        const query = opts?.q ?? q
        const g = opts?.group ?? group
        if (query) params.set('q', query)
        if (stage) params.set('stage', stage)
        if (queue) params.set('queue', queue)
        if (g && g !== 'all' && !stage && !queue) params.set('group', g)

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
              rbtName: c.rbtName,
              rbtProfileId: c.rbtProfileId,
              authExpirationDate: c.authExpirationDate
                ? String(c.authExpirationDate)
                : null,
            })
          )
        )
      })
    },
    [group, q, queue, stage]
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
      }
    }
    window.addEventListener('cs-global-search', onSearch)
    return () => window.removeEventListener('cs-global-search', onSearch)
  }, [load])

  const clearFilters = () => {
    setGroup('all')
    setQ('')
    router.push('/client-services/clients')
  }

  const onExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (stage) params.set('stage', stage)
      if (queue) params.set('queue', queue)
      if (group && group !== 'all' && !stage && !queue) params.set('group', group)
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
            Stage, owner, next action, and attention signals across the journey.
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
        onGroupChange={(g) => {
          setGroup(g)
          if (stage || queue) {
            router.push(`/client-services/clients?group=${g}`)
          } else {
            load({ group: g })
          }
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
