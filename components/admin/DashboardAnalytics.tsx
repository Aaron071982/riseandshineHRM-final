'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users,
  CheckCircle,
  Clock,
  Calendar,
  FileCheck,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  LogIn,
  MapPin,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'

type RangeKey = '7' | '30' | '90' | 'all'

interface Trend {
  direction: 'up' | 'down' | 'neutral'
  percentChange: number
}

interface DashboardData {
  kpis: {
    totalCandidates: number
    hiredRBTs: number
    avgTimeToHireDays: number
    interviewShowRatePercent: number
    onboardingCompletionRatePercent: number
    pendingActions: number
    trends: {
      totalCandidates: Trend
      hiredRBTs: Trend
      avgTimeToHireDays: Trend
      interviewShowRatePercent: Trend
      onboardingCompletionRatePercent: Trend
      pendingActions: Trend
    }
  }
  pipeline: { stages: { name: string; count: number; dropOffPercent: number }[] }
  hiringActivity: { weeks: { weekLabel: string; candidatesAdded: number; hires: number }[] }
  rbtByCity: { city: string; count: number }[]
  rbtGenderSplit: { gender: string; count: number }[]
  sourceBreakdown: { publicApplication: number; adminCreated: number }
  recentSignIns: {
    id: string
    signedInAt: string
    role: string
    displayName: string
    email: string | null
  }[]
  upcomingInterviews: {
    id: string
    scheduledAt: string
    durationMinutes: number
    interviewerName: string
    status: string
    meetingUrl: string | null
    rbtProfile: { id: string; firstName: string; lastName: string }
  }[]
  onboardingAlerts: { id: string; firstName: string; lastName: string; percentage: number; progress: string }[]
  unclaimedTodayCount?: number
}

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All time' },
]

function TrendIndicator({ trend }: { trend: Trend }) {
  if (trend.direction === 'neutral') {
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
        <Minus className="h-3 w-3" /> 0%
      </span>
    )
  }
  if (trend.direction === 'up') {
    return (
      <span className="text-xs text-green-600 dark:text-green-500 flex items-center gap-0.5">
        <TrendingUp className="h-3 w-3" /> +{trend.percentChange}%
      </span>
    )
  }
  return (
    <span className="text-xs text-red-600 dark:text-red-500 flex items-center gap-0.5">
      <TrendingDown className="h-3 w-3" /> -{trend.percentChange}%
    </span>
  )
}

export default function DashboardAnalytics() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rangeParam = searchParams.get('range') || '30'
  const range: RangeKey = ['7', '30', '90', 'all'].includes(rangeParam) ? (rangeParam as RangeKey) : '30'

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/analytics/dashboard?range=${range}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = (body && typeof body.error === 'string') ? body.error : res.statusText
          throw new Error(msg)
        }
        return body
      })
      .then(setData)
      .catch((err) => setError(err?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [range])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const setRange = (value: RangeKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', value)
    router.replace(`/admin/dashboard?${params.toString()}`, { scroll: false })
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-amber-200 dark:border-amber-800">
        <CardContent className="p-6">
          <p className="text-amber-800 dark:text-amber-200 font-medium">Failed to load dashboard</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => loadDashboard()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const {
    kpis,
    pipeline,
    hiringActivity,
    rbtByCity,
    rbtGenderSplit,
    sourceBreakdown,
    recentSignIns,
    upcomingInterviews,
    onboardingAlerts,
    unclaimedTodayCount,
  } = data

  const GENDER_PIE_COLORS = ['#f97316', '#94a3b8', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#64748b']

  const genderPieData = rbtGenderSplit.map((g, i) => ({
    name: g.gender,
    value: g.count,
    color: GENDER_PIE_COLORS[i % GENDER_PIE_COLORS.length],
  }))

  const sourcePieData = [
    { name: 'Public application', value: sourceBreakdown.publicApplication, color: '#f97316' },
    { name: 'Admin created', value: sourceBreakdown.adminCreated, color: '#94a3b8' },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Unclaimed interviews banner */}
      {(unclaimedTodayCount ?? 0) > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              You have {unclaimedTodayCount} unclaimed interview{(unclaimedTodayCount ?? 0) > 1 ? 's' : ''} today &mdash; someone needs to attend!
            </p>
          </div>
          <Link href="/admin/interviews">
            <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300">
              View &amp; Claim
            </Button>
          </Link>
        </div>
      )}

      {/* Date range filter */}
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={range === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRange(opt.value)}
            className={range === opt.value ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Candidates</p>
            <p className="text-2xl font-bold mt-1">{kpis.totalCandidates}</p>
            <TrendIndicator trend={kpis.trends.totalCandidates} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Hired RBTs</p>
            <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-500">{kpis.hiredRBTs}</p>
            <TrendIndicator trend={kpis.trends.hiredRBTs} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Time to Hire</p>
            <p className="text-2xl font-bold mt-1">
              {kpis.avgTimeToHireDays > 0 ? `${kpis.avgTimeToHireDays}d` : '—'}
            </p>
            <TrendIndicator trend={kpis.trends.avgTimeToHireDays} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Interview Show Rate</p>
            <p className="text-2xl font-bold mt-1">{kpis.interviewShowRatePercent}%</p>
            <TrendIndicator trend={kpis.trends.interviewShowRatePercent} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Onboarding Completion</p>
            <p className="text-2xl font-bold mt-1">{kpis.onboardingCompletionRatePercent}%</p>
            <TrendIndicator trend={kpis.trends.onboardingCompletionRatePercent} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Actions</p>
            <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-500">{kpis.pendingActions}</p>
            <TrendIndicator trend={kpis.trends.pendingActions} />
          </CardContent>
        </Card>
      </div>

      {/* Funnel + Source: 12-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Funnel</CardTitle>
            <CardDescription>Candidate counts by stage with drop-off %</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 min-h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <BarChart
                  layout="vertical"
                  data={pipeline.stages}
                  margin={{ top: 0, right: 24, left: 80, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [value, 'Count']}
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div className="rounded-lg border bg-white dark:bg-gray-800 p-2 shadow-md text-sm">
                          <p className="font-medium">{payload[0].payload?.name}</p>
                          <p>Count: {payload[0].value}</p>
                          {payload[0].payload?.dropOffPercent != null && (
                            <p>Drop-off: {payload[0].payload.dropOffPercent}%</p>
                          )}
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="count" fill="#f97316" name="Count" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {pipeline.stages.map(
                (s, i) =>
                  i > 0 &&
                  s.dropOffPercent > 0 && (
                    <span key={s.name}>
                      {pipeline.stages[i - 1].name} → {s.name}: {s.dropOffPercent}% drop-off
                    </span>
                  )
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Source Breakdown</CardTitle>
            <CardDescription>Candidates by application source</CardDescription>
          </CardHeader>
          <CardContent>
            {sourcePieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">No data</div>
            ) : (
              <div className="h-64 min-h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                  <PieChart>
                    <Pie
                      data={sourcePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {sourcePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hiring activity: full width line chart */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Hiring Activity</CardTitle>
          <CardDescription>New candidates and hires per week (last 12 weeks)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 min-h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={240}>
              <LineChart data={hiringActivity.weeks} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="candidatesAdded"
                  name="Candidates added"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="hires"
                  name="Hires"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Hired RBT demographics: city + gender */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              Hired RBTs by city
            </CardTitle>
            <CardDescription>Location (city) for all hired RBTs; top cities + Other</CardDescription>
          </CardHeader>
          <CardContent>
            {rbtByCity.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">No hired RBTs yet</div>
            ) : (
              <div className="h-72 min-h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                  <BarChart
                    layout="vertical"
                    data={rbtByCity}
                    margin={{ top: 0, right: 24, left: 12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="city"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => [value, 'RBTs']}
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="rounded-lg border bg-white dark:bg-gray-800 p-2 shadow-md text-sm">
                            <p className="font-medium">{payload[0].payload?.city}</p>
                            <p>Count: {payload[0].value}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="count" fill="#f97316" name="RBTs" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              Hired RBTs by gender
            </CardTitle>
            <CardDescription>Distribution across all hired RBTs</CardDescription>
          </CardHeader>
          <CardContent>
            {genderPieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">No hired RBTs yet</div>
            ) : (
              <div className="h-72 min-h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                  <PieChart>
                    <Pie
                      data={genderPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {genderPieData.map((entry, index) => (
                        <Cell key={`gender-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Three-column: Recent sign-ins, Upcoming interviews, Onboarding alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Recent sign-ins
            </CardTitle>
            <CardDescription>Admins and RBTs (last 20 logins)</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSignIns.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No sign-ins recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentSignIns.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 text-sm">
                    <LogIn className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-gray-900 dark:text-gray-100 font-medium truncate">
                          {row.displayName}
                        </p>
                        <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                          {row.role === 'ADMIN' ? 'Admin' : 'RBT'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(row.signedInAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {row.email ? ` · ${row.email}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Upcoming Interviews
            </CardTitle>
            <CardDescription>Next 5 scheduled</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingInterviews.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No upcoming interviews</p>
            ) : (
              <div className="space-y-3">
                {upcomingInterviews.map((int) => {
                  const start = new Date(int.scheduledAt)
                  const startStr = start.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                  return (
                    <div
                      key={int.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-800"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {int.rbtProfile.firstName} {int.rbtProfile.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{startStr} · {int.interviewerName}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="info" className="text-xs">
                          {int.status}
                        </Badge>
                        <Link href={`/admin/rbts/${int.rbtProfile.id}`}>
                          <Button variant="outline" size="sm">
                            Take Notes
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
                <Link href="/admin/interviews">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    View all
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-amber-500" />
              Onboarding Alerts
            </CardTitle>
            <CardDescription>Lowest progress (not completed)</CardDescription>
          </CardHeader>
          <CardContent>
            {onboardingAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No alerts</p>
            ) : (
              <ul className="space-y-2">
                {onboardingAlerts.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {r.firstName} {r.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.progress} tasks · {r.percentage}%
                      </p>
                    </div>
                    <Link href={`/admin/rbts/${r.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
