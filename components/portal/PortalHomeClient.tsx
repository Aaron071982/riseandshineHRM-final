'use client'

import Link from 'next/link'
import { formatCalendarDate } from '@/lib/billing/calendarDate'
import type { BcbaPortalDashboard } from '@/lib/crm/bcbaPortalDashboard'
import { cn } from '@/lib/utils'

const ASSESSMENT_PILL: Record<string, string> = {
  DRAFT: 'bg-[color-mix(in_srgb,var(--line)_80%,white)] text-[var(--muted-ink)]',
  IN_PROGRESS: 'bg-[color-mix(in_srgb,var(--sunrise)_18%,white)] text-[var(--espresso)]',
  COMPLETED: 'bg-[color-mix(in_srgb,var(--stage-clinical)_18%,white)] text-[var(--espresso)]',
  SIGNED: 'bg-[color-mix(in_srgb,var(--espresso)_12%,white)] text-[var(--espresso)]',
}

function assessmentLabel(status: string | null) {
  if (!status) return 'Not started'
  return status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function Stat({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-quiet">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-[var(--espresso)]">
        {value}
      </p>
    </div>
  )
}

export function PortalHomeClient({
  data,
  isLead,
}: {
  data: BcbaPortalDashboard
  isLead: boolean
}) {
  const needsWork = data.assessments.filter(
    (a) => a.status === 'DRAFT' || a.status === 'IN_PROGRESS'
  )
  const finished = data.assessments.filter(
    (a) => a.status === 'COMPLETED' || a.status === 'SIGNED'
  )

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sunrise)]">
            {isLead ? 'Clinical lead portal' : 'BCBA portal'}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--espresso)] sm:text-4xl">
            Welcome{data.greetingName ? `, ${data.greetingName}` : ''}
          </h1>
          {data.credentialsLine ? (
            <p className="text-[var(--muted-ink)]">{data.credentialsLine}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/portal/assessments"
            className="inline-flex rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-[var(--espresso)] hover:bg-canvas"
          >
            All assessments
          </Link>
          <Link
            href="/portal/pay"
            className="inline-flex rounded-lg bg-[var(--sunrise)] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            Pay stubs
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Clients" value={data.clientCount} />
        <Stat label="In progress" value={data.assessmentMix.inProgress} />
        <Stat label="Draft" value={data.assessmentMix.draft} />
        <Stat label="Completed" value={data.assessmentMix.completed} />
        <Stat label="Signed" value={data.assessmentMix.signed} />
        <Stat label="Auth ending ≤30d" value={data.authExpiring30} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
        <div className="rounded-2xl border border-line bg-surface">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--espresso)]">
                Caseload
              </h2>
              <p className="mt-1 text-sm text-quiet">
                Open a client for overview, authorization, assessment, and schedule.
              </p>
            </div>
            <p className="text-sm text-quiet">
              {data.clientCount} client{data.clientCount === 1 ? '' : 's'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-canvas/80 text-quiet">
                <tr>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-3 py-3 font-medium">Code</th>
                  <th className="px-3 py-3 font-medium">DOB</th>
                  <th className="px-3 py-3 font-medium">Assessment</th>
                  <th className="px-3 py-3 font-medium">Next reassessment</th>
                  <th className="px-3 py-3 font-medium">Auth end</th>
                  <th className="px-3 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-line/70 hover:bg-canvas/50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/portal/clients/${c.id}`}
                        className="font-medium text-[var(--espresso)] hover:text-[var(--sunrise)]"
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-quiet">
                      {c.clientCode}
                    </td>
                    <td className="px-3 py-3 text-quiet">
                      {c.dateOfBirth ? formatCalendarDate(c.dateOfBirth) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize',
                          ASSESSMENT_PILL[c.assessmentStatus ?? ''] ??
                            'bg-canvas text-quiet'
                        )}
                      >
                        {assessmentLabel(c.assessmentStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-quiet">
                      {c.nextReassessmentDate
                        ? formatCalendarDate(c.nextReassessmentDate)
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-quiet">
                      {c.authEndDate ? formatCalendarDate(c.authEndDate) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/portal/clients/${c.id}?tab=assessment`}
                          className="text-xs font-medium text-[var(--espresso)] underline-offset-2 hover:underline"
                        >
                          Open
                        </Link>
                        {c.assessmentId ? (
                          <>
                            <span className="text-line">·</span>
                            <Link
                              href={`/portal/clients/${c.id}/assessments/${c.assessmentId}`}
                              className="text-xs font-medium text-[var(--espresso)] underline-offset-2 hover:underline"
                            >
                              Edit
                            </Link>
                            <span className="text-line">·</span>
                            <Link
                              href={`/portal/clients/${c.id}/assessments/${c.assessmentId}/print`}
                              className="text-xs font-medium text-[var(--sunrise)] underline-offset-2 hover:underline"
                              target="_blank"
                            >
                              Preview
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {data.clients.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-[var(--muted-ink)]"
                    >
                      No clients assigned yet. They&apos;ll appear here once assigned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-lg font-semibold text-[var(--espresso)]">
              Needs attention
            </h2>
            <ul className="mt-4 space-y-2">
              {data.actionQueue.length === 0 && (
                <li className="text-sm text-quiet">
                  You&apos;re caught up — nothing waiting right now.
                </li>
              )}
              {data.actionQueue.map((item) => (
                <li key={item.id}>
                  <Link
                    href={
                      item.assessmentId
                        ? `/portal/clients/${item.clientId}/assessments/${item.assessmentId}`
                        : `/portal/clients/${item.clientId}?tab=assessment`
                    }
                    className="block rounded-xl border border-line px-3 py-2.5 text-sm hover:bg-canvas"
                  >
                    <span className="font-medium text-ink">
                      {item.clientName}{' '}
                      <span className="text-quiet">({item.clientCode})</span>
                    </span>
                    <span className="mt-0.5 block text-quiet">{item.reason}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-[var(--espresso)]">
                Assessments
              </h2>
              <Link
                href="/portal/assessments"
                className="text-xs font-medium text-[var(--sunrise)] hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded-lg bg-canvas px-3 py-3">
                <p className="font-display text-xl font-semibold text-[var(--espresso)]">
                  {needsWork.length}
                </p>
                <p className="text-xs text-quiet">To do</p>
              </div>
              <div className="rounded-lg bg-canvas px-3 py-3">
                <p className="font-display text-xl font-semibold text-[var(--espresso)]">
                  {finished.length}
                </p>
                <p className="text-xs text-quiet">Done</p>
              </div>
            </div>
          </div>

          <Link
            href="/portal/pay"
            className="block rounded-2xl border border-line bg-surface p-5 transition hover:border-[color-mix(in_srgb,var(--sunrise)_45%,var(--line))]"
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--sunrise)]">
              Pay stubs
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-[var(--espresso)]">
              Your pay stubs
            </h2>
            <p className="mt-2 text-sm text-quiet">
              Statements appear here after payroll sends them to your portal.
            </p>
            <span className="mt-4 inline-flex text-sm font-medium text-[var(--sunrise)]">
              Open pay stubs →
            </span>
          </Link>
        </aside>
      </section>
    </div>
  )
}
