import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CycleStatusBadge, MatchStatusBadge } from '@/components/billing/MatchStatusBadge'
import { CurrencyCell } from '@/components/billing/CurrencyCell'
import SessionDrilldown from '@/components/billing/SessionDrilldown'
import ExcludedProvidersSection from '@/components/billing/ExcludedProvidersSection'
import CycleDetailActions from '@/components/billing/CycleDetailActions'
import CyclePayrollReview from '@/components/billing/CyclePayrollReview'
import { HoursConfirmationLog } from '@/components/billing/HoursConfirmationModal'
import { parsePayableStatusesJson } from '@/lib/billing/sessionStatus'
import { formatUsd, formatHours } from '@/lib/billing/format'
import { getCycleDisplayStats } from '@/lib/billing/cycleStats'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function CycleDetailPage({ params }: { params: { id: string } }) {
  const cycle = await prisma.billingCycle.findUnique({
    where: { id: params.id },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      finalizedBy: { select: { name: true, email: true } },
      hoursConfirmations: {
        orderBy: { sentAt: 'desc' },
        include: {
          rbtProfile: { select: { firstName: true, lastName: true } },
          payrollOnly: { select: { fullName: true } },
        },
      },
      entries: {
        orderBy: [{ isExcluded: 'asc' }, { providerNameRaw: 'asc' }],
        include: {
          rbtProfile: { select: { firstName: true, lastName: true, email: true } },
          payrollOnly: { select: { fullName: true, email: true } },
          sessions: { orderBy: { dos: 'asc' } },
        },
      },
    },
  })

  if (!cycle) notFound()

  const user = await getCurrentUser()
  const canReopen = user && isAdmin(user) && cycle.status === 'FINALIZED'

  const payrollEntries = cycle.entries.filter((e) => !e.isExcluded)
  const excludedEntries = cycle.entries.filter((e) => e.isExcluded)
  const payable = payrollEntries.filter(
    (e) => e.matchStatus === 'MATCHED' || e.matchStatus === 'PAYROLL_ONLY'
  )
  const displayStats = getCycleDisplayStats(cycle, payrollEntries)
  const avgHours = payable.length > 0 ? displayStats.totalHours / payable.length : 0

  const canSendHours =
    cycle.status === 'REVIEW' || cycle.status === 'FINALIZED' || cycle.status === 'PAID'
  const cycleLocked = cycle.status === 'FINALIZED' || cycle.status === 'PAID'

  const breakdownEntries = payrollEntries.map((e) => ({
    ...e,
    sessions: e.sessions.map((s) => ({
      sessionStatus: s.sessionStatus,
      actualMinutes: s.actualMinutes,
      dos: s.dos.toISOString(),
      clientName: s.clientName,
    })),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link href="/billing/dashboard" className="text-sm text-[#0D9488] hover:underline">
            ← Dashboard
          </Link>
          <h2 className="text-2xl font-bold mt-2">{cycle.label}</h2>
          <p className="text-gray-500 text-sm mt-1">
            {format(cycle.periodStart, 'MMM d, yyyy')} – {format(cycle.periodEnd, 'MMM d, yyyy')}
          </p>
          <div className="mt-2">
            <CycleStatusBadge status={cycle.status} />
          </div>
        </div>
        <CycleDetailActions
          cycleId={cycle.id}
          cycleLabel={cycle.label}
          cycleStatus={cycle.status}
          canReopen={!!canReopen}
          canDownload={cycle.status === 'FINALIZED' || cycle.status === 'PAID'}
          canSendHoursConfirmation={canSendHours && payable.length > 0}
        />
      </div>

      <div className="rounded-xl bg-gradient-to-r from-[#0D9488] to-teal-600 text-white p-6 shadow-md">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-teal-100 text-xs uppercase tracking-wide">BTs</p>
            <p className="text-3xl font-bold mt-1">{displayStats.rbtCount}</p>
          </div>
          <div>
            <p className="text-teal-100 text-xs uppercase tracking-wide">Total Hours</p>
            <p className="text-3xl font-bold mt-1">{formatHours(displayStats.totalHours)}</p>
          </div>
          <div>
            <p className="text-teal-100 text-xs uppercase tracking-wide">Gross Pay</p>
            <p className="text-3xl font-bold mt-1">{formatUsd(displayStats.totalGrossPay)}</p>
          </div>
          <div>
            <p className="text-teal-100 text-xs uppercase tracking-wide">Avg Hrs / BT</p>
            <p className="text-3xl font-bold mt-1">{avgHours.toFixed(1)}</p>
          </div>
        </div>
        {cycle.sourceFileName && (
          <p className="text-teal-100 text-xs mt-4">Source: {cycle.sourceFileName}</p>
        )}
        <HoursConfirmationLog confirmations={cycle.hoursConfirmations} />
      </div>

      <CyclePayrollReview
        cycleId={cycle.id}
        cycleLocked={cycleLocked}
        payableStatusesJson={cycle.payableStatuses ?? parsePayableStatusesJson(null)}
        entries={breakdownEntries}
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Session detail by provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payable.map((e) => (
              <div
                key={e.id}
                className="border rounded-lg p-4 dark:border-[var(--border-subtle)] hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {e.rbtProfile
                        ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`
                        : e.payrollOnly?.fullName ?? e.providerNameRaw}
                    </p>
                    <p className="text-xs text-gray-500">Artemis: {e.providerNameRaw}</p>
                    <MatchStatusBadge status={e.matchStatus} className="mt-1" />
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      {e.totalSessions} sessions · {formatHours(e.totalHours)} hrs @{' '}
                      <CurrencyCell value={e.hourlyRate} />
                    </p>
                    <p className="font-semibold">
                      Final: <CurrencyCell value={e.finalPay} />
                    </p>
                  </div>
                </div>
                <SessionDrilldown
                  sessions={e.sessions.map((s) => ({
                    ...s,
                    dos: s.dos.toISOString(),
                  }))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ExcludedProvidersSection entries={excludedEntries} />

      {cycle.finalizedAt && (
        <p className="text-xs text-gray-500">
          Finalized {format(cycle.finalizedAt, 'PPp')}
          {cycle.finalizedBy?.name ? ` by ${cycle.finalizedBy.name}` : ''}
        </p>
      )}
    </div>
  )
}
