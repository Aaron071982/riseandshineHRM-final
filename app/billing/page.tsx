import { Suspense } from 'react'
import PayrollBillingHub from '@/components/billing/PayrollBillingHub'
import { loadUnifiedDashboard } from '@/lib/payroll/loadUnifiedDashboard'

export const dynamic = 'force-dynamic'

export default async function PayrollBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string; segment?: string }>
}) {
  const sp = await searchParams
  const data = await loadUnifiedDashboard(sp.period ?? null)

  return (
    <Suspense fallback={<div className="text-sm text-[#2A2019]/55">Loading…</div>}>
      <PayrollBillingHub data={data} />
    </Suspense>
  )
}
