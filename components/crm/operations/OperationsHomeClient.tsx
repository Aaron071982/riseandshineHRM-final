'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import {
  loadOperationsOverview,
  previewWeeklySummaryEmail,
} from '@/lib/operations/actions'
import { REPORT_CATALOG } from '@/lib/operations/reportCatalog'
import type { OpsOverviewData } from '@/lib/operations/overview'
import { OpsOverviewCharts } from '@/components/crm/operations/OpsOverviewCharts'

export function OperationsHomeClient() {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<OpsOverviewData | null>(null)
  const [weeklyHtml, setWeeklyHtml] = useState<string | null>(null)
  const [weeklyMeta, setWeeklyMeta] = useState<{
    subject: string
    weekRange: string
    sentCount: number
  } | null>(null)

  useEffect(() => {
    start(async () => {
      const res = await loadOperationsOverview()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOverview(res.overview)
    })
  }, [])

  const previewWeekly = () => {
    start(async () => {
      setError('')
      const res = await previewWeeklySummaryEmail()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setWeeklyHtml(res.html)
      setWeeklyMeta({
        subject: res.subject,
        weekRange: res.weekRange,
        sentCount: res.sentCount,
      })
    })
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sunrise)]">
          Operations
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Reports &amp; insights
        </h1>
        <p className="max-w-2xl text-sm text-quiet">
          Read-only leadership views over your visible client set. Every chart and
          table respects claim/role scope — aggregates never bypass RBAC.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/client-services/operations/query"
            className="inline-flex h-9 items-center rounded-lg bg-[var(--sunrise)] px-3 text-xs font-semibold text-white"
          >
            Open query builder
          </Link>
          <button
            type="button"
            onClick={previewWeekly}
            disabled={pending}
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink disabled:opacity-50"
          >
            Preview weekly email summary
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {overview ? (
        <OpsOverviewCharts data={overview} />
      ) : (
        <p className="text-sm text-quiet">{pending ? 'Loading overview…' : ''}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Standard reports</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_CATALOG.map((r) => (
            <Link
              key={r.key}
              href={`/client-services/operations/reports/${r.key}`}
              className="rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-[var(--sunrise)]/40"
            >
              <h3 className="text-sm font-semibold text-ink">{r.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-quiet">
                {r.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {weeklyMeta && weeklyHtml ? (
        <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-lg font-semibold text-ink">Weekly summary preview</h2>
          <p className="text-xs text-quiet">
            {weeklyMeta.subject} · {weeklyMeta.weekRange} · {weeklyMeta.sentCount}{' '}
            emails (not sent — preview only)
          </p>
          <iframe
            title="Weekly summary preview"
            className="h-[480px] w-full rounded-lg border border-line bg-white"
            srcDoc={weeklyHtml}
          />
        </section>
      ) : null}
    </div>
  )
}
