'use client'

import type { Metrics } from '@/lib/artemis/metrics'
import type { Rates, PayerType } from '@/lib/artemis/types'
import { UNITS_PER_HOUR } from '@/lib/artemis/metrics'
import { usd2, pct, nfmt } from './formatters'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ServicesTabProps {
  metrics: Metrics
  rates: Rates
  onRatesChange: (rates: Rates) => void
}

export default function ServicesTab({ metrics, rates, onRatesChange }: ServicesTabProps) {
  const { byCpt } = metrics
  const payerTypes: PayerType[] = ['Medicaid', 'Commercial', 'Tricare']

  const updateRate = (payerType: PayerType, cpt: string, value: string) => {
    const n = parseFloat(value)
    if (isNaN(n)) return
    onRatesChange({
      ...rates,
      [payerType]: { ...rates[payerType], [cpt]: n },
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Services by CPT</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-4">CPT</th>
              <th className="pb-2 pr-4">Service</th>
              <th className="pb-2 pr-4">Provider</th>
              <th className="pb-2 pr-4 text-right">Units</th>
              <th className="pb-2 pr-4 text-right">Hours</th>
              <th className="pb-2 pr-4 text-right">Value</th>
              <th className="pb-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {byCpt.map((r) => (
              <tr key={r.cpt} className="border-b dark:border-gray-800 last:border-0">
                <td className="py-2 pr-4 font-mono text-xs">{r.cpt}</td>
                <td className="py-2 pr-4">{r.label}</td>
                <td className="py-2 pr-4 text-gray-500">{r.provider}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{nfmt(r.units)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.hours.toFixed(1)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{usd2(r.value)}</td>
                <td className="py-2 text-right tabular-nums">{pct(r.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {byCpt.length === 0 && (
          <p className="text-sm text-gray-500 py-8 text-center">No service data</p>
        )}
      </div>

      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 text-sm text-blue-900 dark:text-blue-100">
        <strong>Units → hours:</strong> Artemis bills in 15-minute units. We divide by{' '}
        {UNITS_PER_HOUR} ({UNITS_PER_HOUR} units = 1 hour).
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
        <h3 className="text-sm font-semibold mb-3">Rate card ($/unit)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Used when the export has no Practice Fee. Saved locally in your browser.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {payerTypes.map((pt) => (
            <div key={pt}>
              <p className="text-xs font-semibold text-gray-500 mb-2">{pt}</p>
              <div className="space-y-2">
                {Object.entries(rates[pt]).map(([cpt, rate]) => (
                  <div key={cpt} className="flex items-center gap-2">
                    <Label className="w-14 text-xs font-mono shrink-0">{cpt}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-sm tabular-nums"
                      value={rate}
                      onChange={(e) => updateRate(pt, cpt, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
