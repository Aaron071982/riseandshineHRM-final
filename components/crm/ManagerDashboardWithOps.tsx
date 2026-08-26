'use client'

import { useEffect, useState } from 'react'
import ManagerDashboard from '@/components/crm/ManagerDashboard'
import { OpsOverviewCharts } from '@/components/crm/operations/OpsOverviewCharts'
import {
  loadOperationsOverview,
  previewWeeklySummaryEmail,
} from '@/lib/operations/actions'
import type { OpsOverviewData } from '@/lib/operations/overview'
import type { ManagerDashboardData } from '@/lib/crm/dashboard'
import Link from 'next/link'
import { REPORT_CATALOG } from '@/lib/operations/reportCatalog'

/**
 * Dashboard shell: urgent health high, pipeline funnel, then ops charts under funnel,
 * then department queues / remaining health / performance. No standalone Operations tab.
 */
export default function ManagerDashboardWithOps({
  data,
  showOps,
}: {
  data: ManagerDashboardData
  showOps: boolean
}) {
  const [ops, setOps] = useState<OpsOverviewData | null>(null)
  const [opsLoading, setOpsLoading] = useState(showOps)
  const [weeklyHtml, setWeeklyHtml] = useState<string | null>(null)
  const [weeklyBusy, setWeeklyBusy] = useState(false)

  useEffect(() => {
    if (!showOps) return
    let cancelled = false
    ;(async () => {
      setOpsLoading(true)
      const res = await loadOperationsOverview()
      if (!cancelled && res.ok) setOps(res.overview)
      if (!cancelled) setOpsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [showOps])

  return (
    <ManagerDashboard
      data={data}
      opsSlot={
        showOps ? (
          <div className="space-y-4">
            {opsLoading ? (
              <p className="text-sm text-quiet">Loading charts…</p>
            ) : ops ? (
              <OpsOverviewCharts data={ops} omitFunnel />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={weeklyBusy}
                onClick={async () => {
                  setWeeklyBusy(true)
                  const res = await previewWeeklySummaryEmail()
                  setWeeklyBusy(false)
                  if (res.ok) setWeeklyHtml(res.html)
                }}
                className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
              >
                {weeklyBusy ? 'Building…' : 'Preview weekly email'}
              </button>
              <span className="text-xs text-quiet">Reports:</span>
              {REPORT_CATALOG.slice(0, 6).map((r) => (
                <Link
                  key={r.key}
                  href={`/client-services/operations/reports/${r.key}`}
                  className="text-xs font-medium text-[var(--sunrise)] hover:underline"
                >
                  {r.title}
                </Link>
              ))}
              <Link
                href="/client-services/operations/reports/authorizations-expiring"
                className="text-xs font-medium text-[var(--sunrise)] hover:underline"
              >
                More reports →
              </Link>
            </div>
            {weeklyHtml ? (
              <div className="overflow-hidden rounded-xl border border-line">
                <iframe
                  title="Weekly summary preview"
                  srcDoc={weeklyHtml}
                  className="h-[28rem] w-full bg-white"
                />
              </div>
            ) : null}
          </div>
        ) : null
      }
    />
  )
}
