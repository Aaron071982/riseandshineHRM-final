'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import PayRateInput from '@/components/billing/PayRateInput'
import { formatUsd } from '@/lib/billing/format'
import { format } from 'date-fns'
import { AlertTriangle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type RateRow = {
  id: string
  firstName: string
  lastName: string
  hourlyPayRate: number | null
  artemisProviderName: string | null
  payRateUpdatedAt: string | null
  payRateUpdatedBy: string | null
  suggestedHourlyRate: number | null
  missingRate: boolean
}

type PayrollOnlyRow = {
  id: string
  fullName: string
  artemisProviderName: string
  email: string | null
  hourlyPayRate: number | null
}

type RbtMapping = {
  id: string
  firstName: string
  lastName: string
  artemisProviderName: string | null
  hourlyPayRate: number | null
}

export default function RatesPageClient() {
  const [tab, setTab] = useState<'rates' | 'mappings'>('rates')
  const [rates, setRates] = useState<RateRow[]>([])
  const [missingCount, setMissingCount] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [rbtMappings, setRbtMappings] = useState<RbtMapping[]>([])
  const [payrollOnly, setPayrollOnly] = useState<PayrollOnlyRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [ratesRes, mapRes] = await Promise.all([
      fetch('/api/billing/rates'),
      fetch('/api/billing/mappings'),
    ])
    const ratesData = await ratesRes.json()
    const mapData = await mapRes.json()
    if (ratesRes.ok) {
      setRates(ratesData.rates)
      setMissingCount(ratesData.missingCount)
    }
    if (mapRes.ok) {
      setRbtMappings(mapData.rbtMappings)
      setPayrollOnly(mapData.payrollOnly)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updateRate = async (rbtId: string, hourlyPayRate: number | null) => {
    const res = await fetch(`/api/billing/rates/${rbtId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hourlyPayRate }),
    })
    if (res.ok) await load()
  }

  const updateArtemisName = async (rbtId: string, artemisProviderName: string) => {
    await fetch(`/api/billing/mappings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'rbt', id: rbtId, artemisProviderName }),
    })
    await load()
  }

  const updatePayrollOnly = async (row: PayrollOnlyRow) => {
    await fetch('/api/billing/mappings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payroll_only',
        id: row.id,
        fullName: row.fullName,
        artemisProviderName: row.artemisProviderName,
        email: row.email,
        hourlyPayRate: row.hourlyPayRate,
      }),
    })
    await load()
  }

  const addPayrollOnly = async () => {
    const fullName = prompt('Full name')
    const artemis = prompt('Exact Artemis provider name')
    if (!fullName || !artemis) return
    await fetch('/api/billing/mappings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payroll_only',
        fullName,
        artemisProviderName: artemis,
      }),
    })
    await load()
  }

  const filtered = rates.filter((r) => {
    const q = search.toLowerCase()
    const name = `${r.firstName} ${r.lastName}`.toLowerCase()
    const artemis = (r.artemisProviderName ?? '').toLowerCase()
    return name.includes(q) || artemis.includes(q)
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/billing/dashboard" className="text-sm text-[#0D9488] hover:underline">
          ← Dashboard
        </Link>
        <h2 className="text-2xl font-bold mt-2">Pay Rates &amp; Mappings</h2>
        <p className="text-gray-600 dark:text-[var(--text-secondary)] mt-1">
          Hourly rates and Artemis name mappings for RBTs and payroll-only people
        </p>
      </div>

      <div className="flex gap-2 border-b dark:border-[var(--border-subtle)]">
        {(['rates', 'mappings'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-[#0D9488] text-[#0D9488]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            )}
          >
            {t === 'rates' ? 'Pay Rates' : 'Manage Mappings'}
          </button>
        ))}
      </div>

      {tab === 'rates' && (
        <>
          {missingCount > 0 && (
            <div className="rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {missingCount} RBT{missingCount !== 1 ? 's' : ''} missing pay rates
            </div>
          )}
          <Input
            placeholder="Search by name or Artemis mapping…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border dark:border-[var(--border-subtle)] shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[var(--bg-elevated)]">
                  <tr className="text-left">
                    <th className="px-3 py-2">RBT</th>
                    <th className="px-3 py-2">Hourly Rate</th>
                    <th className="px-3 py-2">Artemis Name</th>
                    <th className="px-3 py-2">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t dark:border-[var(--border-subtle)] ${
                        r.missingRate ? 'bg-red-50 dark:bg-red-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-3 font-medium">
                        {r.firstName} {r.lastName}
                      </td>
                      <td className="px-3 py-3">
                        <PayRateInput
                          value={r.hourlyPayRate}
                          suggested={r.suggestedHourlyRate}
                          onSave={(rate) => updateRate(r.id, rate)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          className="h-8 max-w-[220px]"
                          defaultValue={r.artemisProviderName ?? ''}
                          placeholder="Exact Artemis name"
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v !== (r.artemisProviderName ?? '')) {
                              updateArtemisName(r.id, v)
                            }
                          }}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {r.payRateUpdatedAt ? (
                          <>
                            {formatUsd(r.hourlyPayRate)} ·{' '}
                            {format(new Date(r.payRateUpdatedAt), 'M/d/yy')}
                            {r.payRateUpdatedBy ? ` by ${r.payRateUpdatedBy}` : ''}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'mappings' && (
        <div className="space-y-8">
          <section>
            <h3 className="font-semibold mb-3">RBT Artemis mappings</h3>
            <p className="text-sm text-gray-500 mb-4">
              Saved provider name → RBT profile. Used for auto-matching in future cycles.
            </p>
            <div className="overflow-x-auto rounded-xl border dark:border-[var(--border-subtle)] shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[var(--bg-elevated)]">
                  <tr>
                    <th className="px-3 py-2 text-left">RBT</th>
                    <th className="px-3 py-2 text-left">Artemis name</th>
                  </tr>
                </thead>
                <tbody>
                  {rbtMappings.map((m) => (
                    <tr key={m.id} className="border-t dark:border-[var(--border-subtle)]">
                      <td className="px-3 py-2">
                        {m.firstName} {m.lastName}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 max-w-xs"
                          defaultValue={m.artemisProviderName ?? ''}
                          onBlur={(e) => updateArtemisName(m.id, e.target.value.trim())}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">Payroll-only people</h3>
                <p className="text-sm text-gray-500">
                  Lightweight payees — not in the RBT roster, no login.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addPayrollOnly}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border dark:border-[var(--border-subtle)] shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-50 dark:bg-blue-950/20">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Artemis name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollOnly.map((p) => (
                    <tr key={p.id} className="border-t dark:border-[var(--border-subtle)]">
                      <td className="px-3 py-2">
                        <Input
                          className="h-8"
                          defaultValue={p.fullName}
                          onBlur={(e) =>
                            updatePayrollOnly({ ...p, fullName: e.target.value.trim() })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8"
                          defaultValue={p.artemisProviderName}
                          onBlur={(e) =>
                            updatePayrollOnly({
                              ...p,
                              artemisProviderName: e.target.value.trim(),
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8"
                          type="email"
                          defaultValue={p.email ?? ''}
                          onBlur={(e) =>
                            updatePayrollOnly({ ...p, email: e.target.value.trim() || null })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <PayRateInput
                          value={p.hourlyPayRate}
                          onSave={(rate) => updatePayrollOnly({ ...p, hourlyPayRate: rate })}
                        />
                      </td>
                    </tr>
                  ))}
                  {payrollOnly.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                        No payroll-only people yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
