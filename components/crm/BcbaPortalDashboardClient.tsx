'use client'

import Link from 'next/link'
import { formatCalendarDate } from '@/lib/billing/calendarDate'
import type { BcbaPortalDashboard } from '@/lib/crm/bcbaPortalDashboard'
import { cn } from '@/lib/utils'

export function BcbaPortalDashboardClient({
  data,
  isLead,
}: {
  data: BcbaPortalDashboard
  isLead: boolean
}) {
  const mixTotal =
    data.assessmentMix.draft +
    data.assessmentMix.inProgress +
    data.assessmentMix.signed +
    data.assessmentMix.completed

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--sunrise)]">
          {isLead ? 'Clinical lead' : 'BCBA portal'}
        </p>
        <h1 className="font-display text-3xl font-semibold text-[var(--espresso)]">
          Hello, {data.greetingName}
        </h1>
        <p className="text-[var(--muted-ink)]">
          {data.clientCount} client{data.clientCount === 1 ? '' : 's'}{' '}
          {isLead ? 'across the clinical caseload' : 'assigned to you'}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Assessments in progress"
          value={data.assessmentMix.draft + data.assessmentMix.inProgress}
        />
        <Kpi
          label="Signed / completed"
          value={data.assessmentMix.signed + data.assessmentMix.completed}
        />
        <Kpi label="Reassessments (90d)" value={data.reassessmentsDue} />
        <Kpi label="Auths expiring ≤30d" value={data.authExpiring30} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">
            Assessment status mix
          </h2>
          <p className="mt-1 text-sm text-quiet">Across your visible caseload</p>
          <div className="mt-5 space-y-3">
            <MixBar
              label="Draft"
              count={data.assessmentMix.draft}
              total={mixTotal}
              className="bg-[var(--line)]"
            />
            <MixBar
              label="In progress"
              count={data.assessmentMix.inProgress}
              total={mixTotal}
              className="bg-[var(--sunrise)]"
            />
            <MixBar
              label="Completed"
              count={data.assessmentMix.completed}
              total={mixTotal}
              className="bg-[var(--stage-clinical)]"
            />
            <MixBar
              label="Signed"
              count={data.assessmentMix.signed}
              total={mixTotal}
              className="bg-[var(--espresso)]"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">
            Needs your attention
          </h2>
          <ul className="mt-4 space-y-2">
            {data.actionQueue.length === 0 && (
              <li className="text-sm text-quiet">Nothing urgent right now.</li>
            )}
            {data.actionQueue.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/client-services/clients/${item.clientId}?tab=assessment`}
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
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-ink">My clients</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-quiet">
              <tr>
                <th className="px-2 py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Code</th>
                <th className="px-2 py-2 font-medium">DOB</th>
                <th className="px-2 py-2 font-medium">Assessment</th>
                <th className="px-2 py-2 font-medium">Auth end</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((c) => (
                <tr key={c.id} className="border-b border-line/70 last:border-0">
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/client-services/clients/${c.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-quiet">{c.clientCode}</td>
                  <td className="px-2 py-2.5 text-quiet">
                    {c.dateOfBirth ? formatCalendarDate(c.dateOfBirth) : '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    {c.assessmentStatus?.replace('_', ' ') || 'None'}
                  </td>
                  <td className="px-2 py-2.5 text-quiet">
                    {c.authEndDate ? formatCalendarDate(c.authEndDate) : '—'}
                  </td>
                </tr>
              ))}
              {data.clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-quiet">
                    No clients assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-quiet">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-[var(--espresso)]">
        {value}
      </p>
    </div>
  )
}

function MixBar({
  label,
  count,
  total,
  className,
}: {
  label: string
  count: number
  total: number
  className: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-quiet">
        <span>{label}</span>
        <span>
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className={cn('h-full rounded-full', className)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
