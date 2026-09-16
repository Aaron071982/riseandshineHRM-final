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

export function PortalHomeClient({
  data,
  isLead,
}: {
  data: BcbaPortalDashboard
  isLead: boolean
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--sunrise)]">
          {isLead ? 'Clinical lead portal' : 'BCBA portal'}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--espresso)] sm:text-4xl">
          Welcome{data.greetingName ? `, ${data.greetingName}` : ''}
        </h1>
        {data.credentialsLine && (
          <p className="text-base text-[var(--muted-ink)]">{data.credentialsLine}</p>
        )}
        <p className="text-[var(--muted-ink)]">
          {data.clientCount} client{data.clientCount === 1 ? '' : 's'}{' '}
          {isLead ? 'across the clinical caseload' : 'assigned to you'}
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(42,32,25,0.04)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--espresso)]">
                Your clients
              </h2>
              <p className="mt-1 text-sm text-quiet">
                Open a client to review overview, authorization, assessment, and
                schedule.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-quiet">
                <tr>
                  <th className="px-2 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">DOB</th>
                  <th className="px-2 py-2 font-medium">Assessment</th>
                  <th className="px-2 py-2 font-medium">Next reassessment</th>
                  <th className="px-2 py-2 font-medium">Auth end</th>
                  <th className="px-2 py-2 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-line/70 last:border-0 hover:bg-canvas/70"
                  >
                    <td className="px-2 py-3">
                      <Link
                        href={`/portal/clients/${c.id}`}
                        className="font-medium text-[var(--espresso)] hover:text-[var(--sunrise)]"
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="px-2 py-3 tabular-nums text-quiet">
                      {c.clientCode}
                    </td>
                    <td className="px-2 py-3 text-quiet">
                      {c.dateOfBirth ? formatCalendarDate(c.dateOfBirth) : '—'}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                          ASSESSMENT_PILL[c.assessmentStatus ?? ''] ??
                            'bg-canvas text-quiet'
                        )}
                      >
                        {assessmentLabel(c.assessmentStatus)}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-quiet">
                      {c.nextReassessmentDate
                        ? formatCalendarDate(c.nextReassessmentDate)
                        : '—'}
                    </td>
                    <td className="px-2 py-3 text-quiet">
                      {c.authEndDate ? formatCalendarDate(c.authEndDate) : '—'}
                    </td>
                    <td className="px-2 py-3 text-quiet">
                      {formatCalendarDate(c.updatedAt)}
                    </td>
                  </tr>
                ))}
                {data.clients.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-2 py-10 text-center text-[var(--muted-ink)]"
                    >
                      No clients assigned to you yet. They&apos;ll appear here once
                      assigned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <Link
            href="/portal/pay"
            className="block rounded-2xl border border-line bg-surface p-5 transition hover:border-[color-mix(in_srgb,var(--sunrise)_45%,var(--line))] hover:shadow-[0_8px_24px_rgba(42,32,25,0.06)]"
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--sunrise)]">
              Pay
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-[var(--espresso)]">
              Your pay stubs
            </h2>
            <p className="mt-2 text-sm text-quiet">
              Contractor statements will show up here once payroll publishes them.
            </p>
            <span className="mt-4 inline-flex text-sm font-medium text-[var(--sunrise)]">
              Open pay stubs →
            </span>
          </Link>

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
                    href={`/portal/clients/${item.clientId}?tab=assessment`}
                    className="block rounded-xl border border-line px-3 py-2 text-sm hover:bg-canvas"
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
        </aside>
      </section>
    </div>
  )
}
