'use client'

import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { OpsOverviewData } from '@/lib/operations/overview'

const ACCENT = '#f2652a'
const ESPRESSO = '#2f2318'
const MUTED = '#8a7a6c'
const SECONDARY = '#c45a1a'

export function OpsOverviewCharts({
  data,
  omitFunnel = false,
}: {
  data: OpsOverviewData
  /** Dashboard already shows the pipeline funnel — skip the duplicate chart. */
  omitFunnel?: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {!omitFunnel ? (
          <ChartCard
            title="Pipeline funnel"
            subtitle="LIVE clients by stage"
            href="/client-services/operations/reports/pipeline-health"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.funnel} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ebe3da" />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 10, fill: MUTED }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11, fill: MUTED }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={ACCENT} name="Clients" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        <ChartCard
          title="Staffing gauge"
          subtitle={
            data.staffing.pctStaffed == null
              ? 'No ACTIVE clients in scope'
              : `${data.staffing.pctStaffed}% of ACTIVE clients have an RBT schedule`
          }
          href="/client-services/operations/reports/unstaffed-active"
        >
          <div className="flex h-[260px] flex-col items-center justify-center gap-3">
            <div className="text-5xl font-semibold tracking-tight text-ink">
              {data.staffing.pctStaffed == null ? '—' : `${data.staffing.pctStaffed}%`}
            </div>
            <p className="text-sm text-quiet">
              {data.staffing.activeStaffed} staffed · {data.staffing.activeUnstaffed}{' '}
              unstaffed · {data.staffing.activeTotal} ACTIVE
            </p>
            <div className="h-3 w-full max-w-sm overflow-hidden rounded-full bg-line-2">
              <div
                className="h-full rounded-full bg-[var(--sunrise)]"
                style={{
                  width: `${data.staffing.pctStaffed ?? 0}%`,
                }}
              />
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="New intakes (12 weeks)"
          subtitle="Clients created per week"
          href="/client-services/operations/reports/new-intakes"
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.intakesByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebe3da" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: MUTED }} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke={ACCENT}
                strokeWidth={2}
                dot={{ r: 3, fill: ACCENT }}
                name="New clients"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Authorizations by band"
          subtitle="Attention window (≤45 days + expired)"
          href="/client-services/operations/reports/authorizations-expiring"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.authBands}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebe3da" />
              <XAxis dataKey="band" tick={{ fontSize: 10, fill: MUTED }} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="assessment" stackId="a" fill={SECONDARY} name="Assessment" />
              <Bar dataKey="treatment" stackId="a" fill={ACCENT} name="Treatment" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Department queue load"
          subtitle="LIVE clients by owning department"
          href="/client-services/operations/reports/department-queue"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.deptLoad}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebe3da" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: MUTED }} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={ESPRESSO} name="Clients" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Case coordinator load"
          subtitle="Top CCs by LIVE caseload"
          href="/client-services/operations/reports/cc-load"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.ccLoad} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebe3da" />
              <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 10, fill: MUTED }}
              />
              <Tooltip />
              <Bar dataKey="count" fill={ACCENT} name="Clients" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {data.gaps.length ? (
        <div className="rounded-xl border border-line bg-[var(--sunrise-soft)]/30 px-4 py-3 text-xs text-quiet">
          <p className="font-semibold text-ink">Not tracked / known gaps</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {data.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  href,
  children,
}: {
  title: string
  subtitle: string
  href: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="text-xs text-quiet">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-[var(--sunrise)] hover:underline"
        >
          Open report
        </Link>
      </div>
      {children}
    </div>
  )
}
