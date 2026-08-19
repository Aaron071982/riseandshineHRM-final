import Link from 'next/link'
import type { ManagerDashboardData } from '@/lib/crm/dashboard'
import {
  OWNER_DEPT_LABELS,
  STAGE_DESCRIPTIONS,
  STAGE_GROUP,
  STAGE_GROUP_LABELS,
} from '@/lib/crm/stages'
import { deptHref } from '@/lib/crm/departments'
import { EXPIRY_TONE_CLASS } from '@/components/crm/ProfilePicker'
import { cn } from '@/lib/utils'

function caseloadHref(params: Record<string, string>) {
  const sp = new URLSearchParams(params)
  return `/client-services/clients?${sp.toString()}`
}

const GROUP_BAR: Record<string, string> = {
  INTAKE: 'bg-[var(--stage-intake)]',
  CLINICAL_AUTH: 'bg-[var(--stage-clinical)]',
  STAFFING: 'bg-[var(--stage-staffing)]',
  COORDINATION: 'bg-[var(--stage-coord)]',
  ACTIVE: 'bg-[var(--stage-active)]',
}

export default function ManagerDashboard({
  data,
}: {
  data: ManagerDashboardData
}) {
  const { kpis, pipeline, queues, health, performance } = data
  const maxFunnel = Math.max(1, ...pipeline.byStage.map((s) => s.count))

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Case coordination
          </h1>
          <p className="mt-0.5 text-sm text-quiet">
            Pipeline health across intake, clinical, billing/plutus, staffing, and active care.
          </p>
        </div>
        <Link
          href="/client-services/clients"
          className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-line-2"
        >
          Open caseload
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="In pipeline"
          value={kpis.inPipeline}
          href={caseloadHref({ queue: 'pipeline' })}
        />
        <KpiTile
          label="Active clients"
          value={kpis.activeClients}
          href={caseloadHref({ queue: 'active' })}
        />
        <KpiTile
          label="Needs attention"
          value={kpis.needsAttention}
          href={caseloadHref({ queue: 'needs_attention' })}
          urgent={kpis.needsAttention > 0}
        />
        <KpiTile
          label="Auth expiring ≤60d"
          value={kpis.authExpiring60}
          href={caseloadHref({ queue: 'auth_expiring' })}
        />
      </div>

      {/* Funnel */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-ink">
            Pipeline funnel
          </h2>
          <p className="text-xs text-quiet">
            Hover a stage for what happens · click to filter caseload
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {pipeline.byStage.map((s) => {
            const group = STAGE_GROUP[s.stage]
            const h = Math.max(8, Math.round((s.count / maxFunnel) * 72))
            return (
              <Link
                key={s.stage}
                href={caseloadHref({ stage: s.stage })}
                className="group flex min-w-[3.25rem] flex-1 flex-col items-center gap-1"
                title={`${s.label} · ${STAGE_GROUP_LABELS[group]}\n${STAGE_DESCRIPTIONS[s.stage]}${s.stalled ? `\n${s.stalled} stalled` : ''}`}
              >
                <span className="text-xs font-semibold tabular-nums text-ink">
                  {s.count}
                </span>
                <div
                  className={cn(
                    'w-full rounded-t-md transition-opacity group-hover:opacity-90',
                    GROUP_BAR[group]
                  )}
                  style={{ height: h }}
                />
                <span className="max-w-full truncate text-[10px] font-medium text-ink">
                  {s.label}
                </span>
                <span className="max-w-full truncate text-[9px] text-quiet">
                  {STAGE_GROUP_LABELS[group]}
                </span>
                {s.stalled > 0 && (
                  <span className="rounded bg-[var(--amber-bg)] px-1 text-[9px] font-medium text-[var(--amber)]">
                    {s.stalled} stall
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      {/* Department queues */}
      <section className="grid gap-3 lg:grid-cols-2">
        <QueueCard
          title="Intake"
          href={deptHref('intake')}
          rows={[
            {
              label: 'New inquiries',
              count: queues.intake.newInquiries,
              href: caseloadHref({ stage: 'INQUIRY' }),
            },
            {
              label: 'Uncontacted',
              count: queues.intake.uncontacted,
              href: caseloadHref({ queue: 'intake_uncontacted' }),
            },
            {
              label: 'Missing documents',
              count: queues.intake.missingDocuments,
              href: caseloadHref({ queue: 'intake_missing_docs' }),
            },
          ]}
        />
        <QueueCard
          title="Clinical"
          href={deptHref('clinical')}
          rows={[
            {
              label: 'Waiting for assessment',
              count: queues.clinical.waitingAssessment,
              href: caseloadHref({ stage: 'ASSESSMENT' }),
            },
            {
              label: 'Assessment overdue',
              count: queues.clinical.assessmentOverdue,
              href: caseloadHref({ queue: 'clinical_assessment_overdue' }),
            },
            {
              label: 'Treatment plan pending',
              count: queues.clinical.treatmentPlanPending,
              href: caseloadHref({ queue: 'clinical_treatment_plan_pending' }),
            },
          ]}
        />
        <QueueCard
          title="Billing / Plutus"
          href={deptHref('billing')}
          rows={[
            {
              label: 'Pending',
              count: queues.billing.pending,
              href: caseloadHref({ queue: 'auth_pending' }),
            },
            {
              label: 'Denied / problem',
              count: queues.billing.denied,
              href: caseloadHref({ queue: 'auth_denied' }),
            },
            {
              label: 'Expiring ≤60d',
              count: queues.billing.expiring60,
              href: caseloadHref({ queue: 'auth_expiring' }),
            },
          ]}
        />
        <QueueCard
          title="Staffing"
          href={deptHref('staffing')}
          rows={[
            {
              label: 'Ready for staffing',
              count: queues.staffing.ready,
              href: caseloadHref({ stage: 'READY_FOR_STAFFING' }),
            },
            {
              label: `Waiting for RBT (max ${queues.staffing.rbtSearchMaxDays}d · avg ${queues.staffing.rbtSearchAvgDays}d)`,
              count: queues.staffing.rbtSearch,
              href: caseloadHref({ stage: 'RBT_SEARCH' }),
            },
            {
              label: 'RBT assigned',
              count: queues.staffing.rbtAssigned,
              href: caseloadHref({ stage: 'RBT_ASSIGNED' }),
            },
          ]}
        />
        <QueueCard
          title="Case coordination"
          href={deptHref('case-coordination')}
          rows={[
            {
              label: 'Schedule pending',
              count: queues.scheduling.schedulePending,
              href: caseloadHref({ stage: 'SCHEDULE_COORDINATION' }),
            },
            {
              label: 'Start date pending',
              count: queues.scheduling.startDatePending,
              href: caseloadHref({ queue: 'schedule_start_pending' }),
            },
          ]}
        />
        <QueueCard
          title="Active"
          href={caseloadHref({ queue: 'active' })}
          rows={[
            {
              label: 'Active clients',
              count: queues.active.activeClients,
              href: caseloadHref({ queue: 'active' }),
            },
            {
              label: 'RBT replacement needed',
              count: queues.active.rbtReplacement,
              href: caseloadHref({ queue: 'rbt_replacement' }),
            },
            {
              label: 'Service gaps / on hold',
              count: queues.active.serviceGaps,
              href: caseloadHref({ queue: 'service_gaps' }),
            },
            {
              label: 'Auth expiring',
              count: queues.active.authExpiring,
              href: caseloadHref({ queue: 'auth_expiring' }),
            },
          ]}
        />
      </section>

      {/* Active health */}
      <section className="grid gap-3 lg:grid-cols-3">
        <HealthCard title="Auth expiring">
          {health.authExpiring.every((b) => b.items.length === 0) ? (
            <Empty>No treatment auths expiring in the next 60 days.</Empty>
          ) : (
            <ul className="space-y-2">
              {health.authExpiring.flatMap((b) =>
                b.items.map((item) => {
                  const tone =
                    item.daysLeft <= 7
                      ? 'urgent'
                      : item.daysLeft <= 30
                        ? 'warning'
                        : 'info'
                  return (
                    <li key={`${item.clientId}-${item.expirationDate}`}>
                      <Link
                        href={`/client-services/clients/${item.clientId}?tab=authorization`}
                        className="block rounded-lg border border-line px-2.5 py-2 hover:bg-line-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">
                            {item.clientName}
                          </span>
                          <span
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                              EXPIRY_TONE_CLASS[tone]
                            )}
                          >
                            {item.daysLeft}d · ≤{b.band}
                          </span>
                        </div>
                        <p className="text-xs text-quiet">
                          {item.payerName} · {item.clientCode}
                        </p>
                      </Link>
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </HealthCard>

        <HealthCard title="RBT replacement needed">
          {health.rbtReplacement.length === 0 ? (
            <Empty>No open RBT replacement alerts — nice.</Empty>
          ) : (
            <ul className="space-y-2">
              {health.rbtReplacement.map((a) => (
                <li key={a.alertId}>
                  <Link
                    href={`/client-services/clients/${a.clientId}?tab=staffing`}
                    className="block rounded-lg border border-line px-2.5 py-2 hover:bg-line-2"
                  >
                    <div className="text-sm font-medium text-ink">{a.clientName}</div>
                    <p className="text-xs text-quiet">{a.message}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </HealthCard>

        <HealthCard title="On break / service gaps">
          {health.onBreak.length === 0 ? (
            <Empty>No clients on hold or mid-break right now.</Empty>
          ) : (
            <ul className="space-y-2">
              {health.onBreak.slice(0, 12).map((row, i) => (
                <li key={`${row.clientId}-${row.kind}-${i}`}>
                  <Link
                    href={`/client-services/clients/${row.clientId}`}
                    className="block rounded-lg border border-line px-2.5 py-2 hover:bg-line-2"
                  >
                    <div className="text-sm font-medium text-ink">{row.clientName}</div>
                    <p className="text-xs text-quiet">{row.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </HealthCard>
      </section>

      {/* Performance */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-base font-semibold text-ink">
          Coordinator performance
        </h2>
        <p className="mt-0.5 text-sm text-quiet">
          Org-wide today (full access). Coordinators will see only their row when that tier is live.
        </p>
        {performance.length === 0 ? (
          <Empty>No case coordinators assigned on the caseload yet.</Empty>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-2 py-2 font-medium">Coordinator</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Assigned</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Completed</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Overdue tasks</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Avg days/stage</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Follow-ups</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Stalled</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((row) => (
                  <tr key={row.userId} className="border-b border-line-2">
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-ink">{row.name}</div>
                      <div className="text-xs text-quiet">{row.email}</div>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">{row.assigned}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row.completed}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row.overdueTasks}</td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {row.avgDaysPerStage ?? '—'}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">{row.followUpsDue}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row.stalled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-faint">
        Owner depts:{' '}
        {Object.entries(OWNER_DEPT_LABELS)
          .map(([k, v]) => `${v}`)
          .join(' · ')}
      </p>
    </div>
  )
}

function KpiTile({
  label,
  value,
  href,
  urgent,
}: {
  label: string
  value: number
  href: string
  urgent?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-xl border bg-surface px-4 py-3 transition-colors hover:border-brand',
        urgent ? 'border-[color-mix(in_srgb,var(--urgent)_35%,var(--line))]' : 'border-line'
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 font-display text-3xl font-semibold tabular-nums',
          urgent ? 'text-[var(--urgent)]' : 'text-ink'
        )}
      >
        {value}
      </div>
    </Link>
  )
}

function QueueCard({
  title,
  href,
  rows,
}: {
  title: string
  href?: string
  rows: { label: string; count: number; href: string }[]
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="font-display text-base font-semibold text-ink">
        {href ? (
          <Link href={href} className="hover:text-brand hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label}>
            <Link
              href={r.href}
              className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand"
            >
              <span className="text-quiet">{r.label}</span>
              <span className="font-semibold tabular-nums text-ink">{r.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HealthCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-2 font-display text-base font-semibold text-ink">{title}</h3>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-quiet">{children}</p>
}
