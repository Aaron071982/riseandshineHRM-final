'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ClientRow } from '@/lib/clients/viewModel'
import { STATUS, statusSortRank, type CaseStatus } from '@/lib/clients/status'
import ClientAvatar from '@/components/clients/ClientAvatar'
import StatusBadge from '@/components/clients/StatusBadge'
import HoursBar from '@/components/clients/HoursBar'
import DocsIndicator from '@/components/clients/DocsIndicator'
import { cn } from '@/lib/utils'

type SortKey = 'name' | 'status' | 'hours' | 'docs'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 25

export default function ClientsTable({
  rows,
  loading,
  onClearFilter,
  filteredEmpty,
}: {
  rows: ClientRow[]
  loading?: boolean
  onClearFilter?: () => void
  filteredEmpty?: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    const list = [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      // default: urgent first via status rank when sorting by status
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'status') {
        const r = (statusSortRank(a.status) - statusSortRank(b.status)) * dir
        return r !== 0 ? r : a.name.localeCompare(b.name)
      }
      if (sortKey === 'hours') {
        const ah = a.hours?.scheduled ?? -1
        const bh = b.hours?.scheduled ?? -1
        return (ah - bh) * dir
      }
      if (sortKey === 'docs') {
        return (a.docs.done - b.docs.done) * dir
      }
      return 0
    })
    return list
  }, [rows, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const shown = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'status' ? 'asc' : 'asc')
    }
    setPage(0)
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="space-y-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (filteredEmpty || sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface px-6 py-16 text-center">
        <p className="text-sm text-quiet">No clients match this filter.</p>
        {onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-3 text-sm font-medium text-brand hover:text-brand-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            Clear filter
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <SortTh label="Client" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
              <SortTh label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
              <th className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-faint">
                BCBA
              </th>
              <th className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-faint">
                Location
              </th>
              <th className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-faint">
                Behavior tech
              </th>
              <SortTh
                label="Hours"
                active={sortKey === 'hours'}
                dir={sortDir}
                onClick={() => toggleSort('hours')}
                align="right"
              />
              <SortTh label="Docs" active={sortKey === 'docs'} dir={sortDir} onClick={() => toggleSort('docs')} />
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <ClientTableRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-quiet">
        <span>
          Showing {shown.length} of {sorted.length} clients
        </span>
        <div className="flex items-center gap-2">
          <span>Page {safePage + 1} / {pageCount}</span>
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-line px-2 py-1 disabled:opacity-40 hover:bg-[var(--line-2)]"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded-md border border-line px-2 py-1 disabled:opacity-40 hover:bg-[var(--line-2)]"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function ClientTableRow({ row }: { row: ClientRow }) {
  const urgent = STATUS[row.status].urgent
  const dimmed = row.status === 'on_hold'

  return (
    <tr
      className={cn(
        'group border-b border-line-2 last:border-0 transition-colors motion-reduce:transition-none',
        dimmed && 'opacity-55',
        'hover:bg-[var(--row-hover)]'
      )}
      style={
        urgent
          ? {
              backgroundImage: 'linear-gradient(90deg,var(--urgent-row),transparent 55%)',
            }
          : undefined
      }
    >
      <td className="px-3 py-2.5">
        <Link href={row.href} className="flex items-center gap-2.5 min-w-0">
          <ClientAvatar name={row.name} status={row.status} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{row.name}</span>
            <span className="block truncate text-xs text-faint">{row.code || '—'}</span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-3 py-2.5 text-quiet">{row.bcba || '—'}</td>
      <td className="px-3 py-2.5 text-quiet">
        <span className="block max-w-[14rem] truncate" title={row.address || row.location || undefined}>
          {row.address || row.location || '—'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {row.behaviorTechs.length === 0 ? (
          <span className="font-medium text-urgent">No BT assigned</span>
        ) : (
          <span className="text-quiet">{row.behaviorTechs.join(', ')}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        {row.hours ? (
          <div className="inline-flex justify-end">
            <HoursBar scheduled={row.hours.scheduled} target={row.hours.target} />
          </div>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <DocsIndicator done={row.docs.done} total={row.docs.total} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <Link
          href={row.href}
          className="text-sm font-medium text-brand hover:text-brand-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          View
        </Link>
      </td>
    </tr>
  )
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: 'right'
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={cn('px-3 py-2.5', align === 'right' && 'text-right')}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-faint hover:text-quiet',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 border-b border-line-2 px-4 py-3 last:border-0">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-line-2 relative">
        <Shimmer />
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-40 overflow-hidden rounded bg-line-2 relative">
          <Shimmer />
        </div>
        <div className="h-2.5 w-24 overflow-hidden rounded bg-line-2 relative">
          <Shimmer />
        </div>
      </div>
      <div className="h-3 w-20 overflow-hidden rounded bg-line-2 relative">
        <Shimmer />
      </div>
      <div className="h-3 w-16 overflow-hidden rounded bg-line-2 relative">
        <Shimmer />
      </div>
    </div>
  )
}

function Shimmer() {
  return (
    <span
      className="absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent)] motion-safe:animate-shimmer"
      aria-hidden
    />
  )
}

export type { CaseStatus }
