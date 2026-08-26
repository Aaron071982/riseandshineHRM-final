'use client'

import Link from 'next/link'
import { Download, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ReportShell({
  title,
  description,
  summary,
  refreshedAt,
  children,
  onRefresh,
  onExport,
  pending,
  backHref = '/client-services/operations',
}: {
  title: string
  description: string
  summary?: string
  refreshedAt?: string
  children: React.ReactNode
  onRefresh?: () => void
  onExport?: () => void
  pending?: boolean
  backHref?: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="text-xs font-medium text-[var(--sunrise)] hover:underline"
          >
            ← Operations
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-quiet">{description}</p>
          {summary ? (
            <p className="mt-2 text-sm font-medium text-ink">{summary}</p>
          ) : null}
          {refreshedAt ? (
            <p className="mt-1 text-xs text-quiet">
              Last refreshed{' '}
              {new Date(refreshedAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} />
              Refresh
            </button>
          ) : null}
          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--sunrise)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  )
}

export function ReportTable({
  columns,
  rows,
}: {
  columns: { key: string; header: string }[]
  rows: Record<string, string | number | null>[]
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-sm text-quiet">
        No rows in your visible scope for this report.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-line-2/40 text-xs uppercase tracking-wide text-quiet">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-line/70 last:border-0 hover:bg-line-2/20"
            >
              {columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 text-ink">
                  {row[c.key] == null || row[c.key] === ''
                    ? '—'
                    : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
