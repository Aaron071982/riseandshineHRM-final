'use client'

import type { Metrics } from '@/lib/artemis/metrics'
import { usd2, nfmt } from './formatters'

export default function ReconciliationTab({ metrics }: { metrics: Metrics }) {
  const { leakage, recoverable } = metrics

  const buckets = [
    { key: 'incomplete', label: 'Incomplete documentation', ...leakage.incomplete },
    { key: 'notClaimed', label: 'Completed, not claimed', ...leakage.notClaimed },
    { key: 'pending', label: 'Submitted, awaiting payment', ...leakage.pending },
    { key: 'denied', label: 'Denied claims', ...leakage.denied },
    { key: 'clientAR', label: 'Client responsibility', ...leakage.clientAR },
    { key: 'cancelled', label: 'Cancelled sessions', ...leakage.cancelled },
    { key: 'mismatch', label: 'Unit mismatches', ...leakage.mismatch },
  ]

  const worklist = [
    ...leakage.denied.rows,
    ...leakage.notClaimed.rows,
    ...leakage.incomplete.rows,
  ]
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      date: r.date,
      client: r.client,
      payer: r.payer,
      status: r.sessionStatus,
      claimStatus: r.claimStatus,
      value: r.allowed || r.charge,
    }))

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/20 p-4">
        <p className="text-sm font-medium text-teal-900 dark:text-teal-100">
          Recoverable revenue estimate: {usd2(recoverable)}
        </p>
        <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">
          Incomplete + not claimed + denied (excludes pending payer adjudication)
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {buckets.map((b) => (
          <div
            key={b.key}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900"
          >
            <p className="text-xs text-gray-500 uppercase">{b.label}</p>
            <p className="text-lg font-bold tabular-nums text-amber-600">{usd2(b.value)}</p>
            <p className="text-xs text-gray-400">{nfmt(b.rows.length)} rows</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Top 15 worklist items</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2 pr-3">Client</th>
              <th className="pb-2 pr-3">Payer</th>
              <th className="pb-2 pr-3">Session</th>
              <th className="pb-2 pr-3">Claim</th>
              <th className="pb-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {worklist.map((r) => (
              <tr key={r.id} className="border-b dark:border-gray-800 last:border-0">
                <td className="py-2 pr-3 tabular-nums">{r.date}</td>
                <td className="py-2 pr-3">{r.client}</td>
                <td className="py-2 pr-3 text-gray-500">{r.payer}</td>
                <td className="py-2 pr-3">{r.status}</td>
                <td className="py-2 pr-3">{r.claimStatus || '—'}</td>
                <td className="py-2 text-right tabular-nums">{usd2(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {worklist.length === 0 && (
          <p className="text-sm text-gray-500 py-8 text-center">No worklist items</p>
        )}
      </div>
    </div>
  )
}
