'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload } from 'lucide-react'
import type { Session, PayerType, Rates } from '@/lib/artemis/types'
import { DEFAULT_RATES } from '@/lib/artemis/parse'
import { computeMetrics } from '@/lib/artemis/metrics'
import UploadPanel, { type UploadResult } from '@/components/operations/UploadPanel'
import CycleHero from '@/components/operations/CycleHero'
import KpiStrip from '@/components/operations/KpiStrip'
import OverviewTab from '@/components/operations/OverviewTab'
import PayersTab from '@/components/operations/PayersTab'
import ServicesTab from '@/components/operations/ServicesTab'
import AuthorizationsTab from '@/components/operations/AuthorizationsTab'
import ReconciliationTab from '@/components/operations/ReconciliationTab'
import DenialsTab from '@/components/operations/DenialsTab'
import { cn } from '@/lib/utils'

const RATE_STORAGE_KEY = 'ops-rate-card'
const PAYER_FILTERS: Array<'All' | PayerType> = ['All', 'Medicaid', 'Commercial', 'Tricare']

export default function OperationsPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [hasRealMoney, setHasRealMoney] = useState(false)
  const [source, setSource] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState(0)
  const [payerTypeFilter, setPayerTypeFilter] = useState<'All' | PayerType>('All')
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES)
  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RATE_STORAGE_KEY)
      if (raw) setRates(JSON.parse(raw) as Rates)
    } catch {
      // ignore
    }
  }, [])

  const persistRates = useCallback((next: Rates) => {
    setRates(next)
    try {
      localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [])

  const onLoaded = useCallback((result: UploadResult) => {
    setSessions(result.sessions)
    setHasRealMoney(result.hasRealMoney)
    setSource(result.source)
    setRowCount(result.rowCount)
  }, [])

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    if (payerTypeFilter === 'All') return sessions
    return sessions.filter((s) => s.payerType === payerTypeFilter)
  }, [sessions, payerTypeFilter])

  const metrics = useMemo(() => {
    if (filteredSessions.length === 0) return null
    return computeMetrics(filteredSessions, rates, today)
  }, [filteredSessions, rates, today])

  const badgeClass = sessions
    ? hasRealMoney
      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
    : 'bg-gray-100 text-gray-600'

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-3 bg-gray-50/95 dark:bg-[var(--bg-primary)]/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Revenue cycle dashboard</h2>
            <p className="text-sm text-gray-500">
              Session Reconciliation → scheduled through collected
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sessions && (
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', badgeClass)}>
                {hasRealMoney ? `${source} · ${rowCount.toLocaleString()} rows` : 'Sample data'}
              </span>
            )}
            <Button size="sm" className="bg-[#0D9488] hover:bg-teal-700" onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
          </div>
        </div>
      </div>

      {!sessions ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center bg-white dark:bg-gray-900">
          <Upload className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold">No data loaded</h3>
          <p className="text-sm text-gray-500 mt-2 mb-4 max-w-md mx-auto">
            Upload an Artemis Session Reconciliation export or load sample data to explore the
            dashboard.
          </p>
          <Button className="bg-[#0D9488] hover:bg-teal-700" onClick={() => setUploadOpen(true)}>
            Get started
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {PAYER_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPayerTypeFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  payerTypeFilter === f
                    ? 'bg-[#0D9488] text-white'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 hover:border-[#0D9488]'
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {metrics && (
            <>
              <CycleHero metrics={metrics} />
              <KpiStrip metrics={metrics} />

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
                  {[
                    ['overview', 'Overview'],
                    ['payers', 'Payers'],
                    ['services', 'Services'],
                    ['authorizations', 'Authorizations'],
                    ['reconciliation', 'Reconciliation'],
                    ['denials', 'Denials'],
                  ].map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="data-[state=active]:bg-[#0D9488] data-[state=active]:text-white"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="overview">
                  <OverviewTab metrics={metrics} />
                </TabsContent>
                <TabsContent value="payers">
                  <PayersTab metrics={metrics} />
                </TabsContent>
                <TabsContent value="services">
                  <ServicesTab metrics={metrics} rates={rates} onRatesChange={persistRates} />
                </TabsContent>
                <TabsContent value="authorizations">
                  <AuthorizationsTab />
                </TabsContent>
                <TabsContent value="reconciliation">
                  <ReconciliationTab metrics={metrics} />
                </TabsContent>
                <TabsContent value="denials">
                  <DenialsTab metrics={metrics} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}

      <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} onLoaded={onLoaded} />
    </div>
  )
}
