import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CycleStatusBadge } from '@/components/billing/MatchStatusBadge'
import { PayoutTrendChart, HoursDistributionChart } from '@/components/billing/BillingDashboardCharts'
import RecentCyclesList from '@/components/billing/RecentCyclesList'
import { formatUsd } from '@/lib/billing/format'
import { getCycleDisplayStats } from '@/lib/billing/cycleStats'
import { format } from 'date-fns'
import {
  Plus,
  AlertTriangle,
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function StatCard({
  title,
  value,
  icon: Icon,
  accent = false,
  warning = false,
  sub,
  href,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  accent?: boolean
  warning?: boolean
  sub?: React.ReactNode
  href?: string
}) {
  const inner = (
    <Card
      className={cn(
        'shadow-sm border-l-4 overflow-hidden',
        accent && 'border-l-[#0D9488] bg-gradient-to-br from-white to-teal-50/40 dark:from-[var(--bg-elevated)] dark:to-teal-950/20',
        warning && 'border-l-red-500',
        !accent && !warning && 'border-l-transparent'
      )}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <p
              className={cn(
                'text-3xl font-bold mt-1 tabular-nums',
                warning && 'text-red-600'
              )}
            >
              {value}
            </p>
            {sub}
          </div>
          <div
            className={cn(
              'p-2 rounded-lg',
              accent ? 'bg-teal-100 text-[#0D9488]' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

export default async function BillingDashboardPage() {
  const [cycles, missingRatesCount, totalCycles, chartCycles] = await Promise.all([
    prisma.billingCycle.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        entries: {
          where: { isExcluded: false },
          select: {
            isExcluded: true,
            totalHours: true,
            grossPay: true,
            matchStatus: true,
            providerNameRaw: true,
            rbtProfile: { select: { firstName: true, lastName: true } },
            payrollOnly: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.rBTProfile.count({
      where: {
        status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] },
        hourlyPayRate: null,
      },
    }),
    prisma.billingCycle.count(),
    prisma.billingCycle.findMany({
      where: { status: { in: ['FINALIZED', 'PAID'] } },
      orderBy: { periodEnd: 'desc' },
      take: 6,
      select: { label: true, totalGrossPay: true, periodEnd: true },
    }),
  ])

  const latestCycle = cycles[0] ?? null
  const latestStats = latestCycle
    ? getCycleDisplayStats(latestCycle, latestCycle.entries)
    : null

  const finalizedCycles = cycles.filter((c) => c.status === 'FINALIZED' || c.status === 'PAID')
  const lastPayout = finalizedCycles[0]?.totalGrossPay ?? 0

  const payoutTrend = [...chartCycles]
    .reverse()
    .map((c) => ({
      label: c.label.length > 12 ? c.label.slice(0, 12) + '…' : c.label,
      payout: c.totalGrossPay,
    }))

  const topBtHours =
    latestCycle?.entries
      .filter((e) => e.matchStatus === 'MATCHED' || e.matchStatus === 'PAYROLL_ONLY')
      .map((e) => ({
        name:
          e.rbtProfile
            ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`.split(' ')[0]
            : (e.payrollOnly?.fullName ?? e.providerNameRaw).split(' ')[0],
        hours: e.totalHours,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6) ?? []

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            Dashboard
          </h2>
          <p className="text-gray-600 dark:text-[var(--text-secondary)] mt-1">
            Biweekly payroll overview
          </p>
        </div>
        <Button asChild className="bg-[#0D9488] hover:bg-teal-700 text-white shadow-sm">
          <Link href="/billing/cycles/new">
            <Plus className="w-4 h-4 mr-2" />
            Start New Payroll Cycle
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Cycles" value={totalCycles} icon={Calendar} />
        <StatCard
          title="Last Cycle Payout"
          value={formatUsd(lastPayout)}
          icon={DollarSign}
          accent
          sub={
            <p className="text-xs text-teal-700 dark:text-teal-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Most recent finalized
            </p>
          }
        />
        <StatCard
          title="Missing Pay Rates"
          value={missingRatesCount}
          icon={AlertTriangle}
          warning={missingRatesCount > 0}
          href={missingRatesCount > 0 ? '/billing/rates' : undefined}
          sub={
            missingRatesCount > 0 ? (
              <p className="text-xs text-red-600 mt-1">Set rates →</p>
            ) : undefined
          }
        />
        <StatCard
          title="Latest Cycle"
          value={latestCycle ? latestStats?.rbtCount ?? '—' : '—'}
          icon={Users}
          sub={
            latestCycle ? (
              <div className="mt-2">
                <p className="text-xs text-gray-500 truncate max-w-[160px]">{latestCycle.label}</p>
                <CycleStatusBadge status={latestCycle.status} />
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1">No cycles yet</p>
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Payout trend (last 6 cycles)</CardTitle>
          </CardHeader>
          <CardContent>
            <PayoutTrendChart data={payoutTrend} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0D9488]" />
              Hours by top BTs — current cycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HoursDistributionChart data={topBtHours} />
          </CardContent>
        </Card>
      </div>

      {latestCycle && latestStats && (
        <Card className="shadow-sm border-[#0D9488]/20">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#0D9488] uppercase tracking-wide">
                  Current cycle
                </p>
                <p className="font-bold text-xl mt-1">{latestCycle.label}</p>
                <p className="text-sm text-gray-500">
                  {format(latestCycle.periodStart, 'MMM d, yyyy')} –{' '}
                  {format(latestCycle.periodEnd, 'MMM d, yyyy')}
                </p>
              </div>
              <div className="flex flex-wrap gap-6 text-center sm:text-right">
                <div>
                  <p className="text-2xl font-bold">{latestStats.rbtCount}</p>
                  <p className="text-xs text-gray-500">BTs</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{latestStats.totalHours.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Hours</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0D9488]">
                    {formatUsd(latestStats.totalGrossPay)}
                  </p>
                  <p className="text-xs text-gray-500">Gross</p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link href={`/billing/cycles/${latestCycle.id}`}>View Cycle</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Recent Cycles</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <RecentCyclesList
            cycles={cycles.map((c) => {
              const stats = getCycleDisplayStats(c, c.entries)
              return {
                id: c.id,
                label: c.label,
                status: c.status,
                periodStart: c.periodStart.toISOString(),
                periodEnd: c.periodEnd.toISOString(),
                totalHours: stats.totalHours,
                totalGrossPay: stats.totalGrossPay,
                rbtCount: stats.rbtCount,
              }
            })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
