'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  exportOperationsReportCsv,
  runOperationsReport,
} from '@/lib/operations/actions'
import type { ReportResult } from '@/lib/operations/reports'
import {
  ReportShell,
  ReportTable,
  downloadCsv,
} from '@/components/crm/operations/ReportShell'

export function ReportPageClient({
  reportKey,
  initialQuickRange,
}: {
  reportKey: string
  initialQuickRange?: 'week_to_date' | 'last_full_week'
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [report, setReport] = useState<ReportResult | null>(null)
  const [quickRange, setQuickRange] = useState<
    'week_to_date' | 'last_full_week' | undefined
  >(initialQuickRange ?? (reportKey === 'email-activity' ? 'week_to_date' : undefined))

  const load = useCallback(() => {
    start(async () => {
      setError('')
      const res = await runOperationsReport(
        reportKey,
        reportKey === 'email-activity' && quickRange
          ? { quickRange }
          : undefined
      )
      if (!res.ok) {
        setError(res.error)
        setReport(null)
        return
      }
      setReport(res.report)
    })
  }, [reportKey, quickRange])

  useEffect(() => {
    load()
  }, [load])

  const onExport = () => {
    start(async () => {
      setError('')
      const res = await exportOperationsReportCsv(
        reportKey,
        reportKey === 'email-activity' && quickRange
          ? { quickRange }
          : undefined
      )
      if (!res.ok) {
        setError(res.error)
        return
      }
      downloadCsv(res.fileName, res.csv)
    })
  }

  return (
    <ReportShell
      title={report?.title ?? 'Loading report…'}
      description={report?.description ?? 'Loading scoped results…'}
      summary={report?.summary}
      refreshedAt={report?.refreshedAt}
      pending={pending}
      onRefresh={load}
      onExport={report ? onExport : undefined}
    >
      {reportKey === 'email-activity' ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setQuickRange('week_to_date')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              quickRange === 'week_to_date'
                ? 'bg-[var(--sunrise)] text-white'
                : 'border border-line bg-surface text-ink'
            }`}
          >
            Week to date
          </button>
          <button
            type="button"
            onClick={() => setQuickRange('last_full_week')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              quickRange === 'last_full_week'
                ? 'bg-[var(--sunrise)] text-white'
                : 'border border-line bg-surface text-ink'
            }`}
          >
            Last full week
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {report ? (
        <ReportTable columns={report.columns} rows={report.rows} />
      ) : (
        !error && (
          <p className="text-sm text-quiet">{pending ? 'Loading…' : 'No data'}</p>
        )
      )}
      {report?.gaps?.length ? (
        <p className="mt-3 text-xs text-quiet">
          Gaps: {report.gaps.join(' · ')}
        </p>
      ) : null}
    </ReportShell>
  )
}
