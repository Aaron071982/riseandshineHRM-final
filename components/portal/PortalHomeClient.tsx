'use client'

import Link from 'next/link'
import { formatCalendarDate } from '@/lib/billing/calendarDate'
import type { BcbaPortalDashboard } from '@/lib/crm/bcbaPortalDashboard'
import { PortalInboxCard } from '@/components/portal/PortalInboxCard'
import { PortalStageStrip } from '@/components/portal/PortalStageStrip'
import {
  PortalAssessmentPill,
  PortalAvatar,
  PortalStatTile,
} from '@/components/portal/PortalUi'
import { cn } from '@/lib/utils'

function timeOfDayGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function CompletionRing({ pct }: { pct: number }) {
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="rgba(42,32,25,0.1)"
          strokeWidth="8"
        />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="var(--portal-orange)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-semibold text-[var(--espresso)]">
          {pct}%
        </span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted-ink)]">
          Done
        </span>
      </div>
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
  const continueAssessment = data.assessments.find(
    (a) => a.status === 'DRAFT' || a.status === 'IN_PROGRESS'
  )

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="portal-hero flex flex-col gap-6 rounded-[20px] border border-[var(--portal-line)] p-6 shadow-[var(--portal-shadow)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--portal-orange-deep)]">
            {isLead ? 'Clinical lead' : 'BCBA'} · {timeOfDayGreeting()}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--espresso)] sm:text-4xl">
            {timeOfDayGreeting()}
            {data.greetingName ? `, ${data.greetingName}` : ''}
          </h1>
          <p className="max-w-xl text-sm text-[var(--muted-ink)]">
            {data.clientCount} client{data.clientCount === 1 ? '' : 's'} on your
            caseload
            {data.inbox.unreadCount > 0
              ? ` · ${data.inbox.unreadCount} new inbox update${
                  data.inbox.unreadCount === 1 ? '' : 's'
                }`
              : ''}
            {data.readyToAssess > 0
              ? ` · ${data.readyToAssess} ready to assess`
              : ''}
            .
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {continueAssessment ? (
              <Link
                href={`/portal/clients/${continueAssessment.clientId}/assessments/${continueAssessment.id}`}
                className="inline-flex rounded-lg bg-[var(--portal-orange)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--portal-orange-deep)]"
              >
                Continue assessment
              </Link>
            ) : (
              <Link
                href="/portal/assessments"
                className="inline-flex rounded-lg bg-[var(--portal-orange)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--portal-orange-deep)]"
              >
                Open assessments
              </Link>
            )}
            <Link
              href="/portal/inbox"
              className="inline-flex rounded-lg border border-[var(--portal-line)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--espresso)] hover:bg-white"
            >
              Open inbox
              {data.inbox.unreadCount > 0 ? ` (${data.inbox.unreadCount})` : ''}
            </Link>
          </div>
        </div>
        <CompletionRing pct={data.caseloadCompletionPct} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <PortalStatTile label="Clients" value={data.clientCount} />
        <PortalStatTile label="Ready to assess" value={data.readyToAssess} />
        <PortalStatTile label="In progress" value={data.assessmentMix.inProgress} />
        <PortalStatTile label="Completed" value={data.assessmentMix.completed} />
        <PortalStatTile label="Signed" value={data.assessmentMix.signed} />
        <PortalStatTile label="Auth ≤30d" value={data.authExpiring30} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
        <div className="rounded-[16px] border border-[var(--portal-line)] bg-white shadow-[var(--portal-shadow)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--portal-line)] px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--espresso)]">
                Caseload
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-ink)]">
                Lifecycle stage, assessment status, and quick open.
              </p>
            </div>
            <p className="text-sm text-[var(--muted-ink)]">
              {data.clientCount} client{data.clientCount === 1 ? '' : 's'}
            </p>
          </div>

          <ul className="divide-y divide-[var(--portal-line)]">
            {data.clients.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-[var(--muted-ink)]">
                No clients assigned yet.
              </li>
            ) : (
              data.clients.map((c) => {
                const name = `${c.firstName} ${c.lastName}`.trim()
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--portal-paper)]"
                  >
                    <PortalAvatar name={name} />
                    <div className="min-w-[10rem] flex-1">
                      <Link
                        href={`/portal/clients/${c.id}`}
                        className="font-medium text-[var(--espresso)] hover:text-[var(--portal-orange)]"
                      >
                        {name}
                      </Link>
                      <p className="text-xs text-[var(--muted-ink)]">
                        <span className="tabular-nums">{c.clientCode}</span>
                        <span className="mx-1.5">·</span>
                        {c.dateOfBirth
                          ? formatCalendarDate(c.dateOfBirth)
                          : 'DOB —'}
                      </p>
                    </div>
                    <PortalStageStrip
                      lifecycle={c.lifecycle}
                      size="sm"
                      className="hidden sm:block"
                    />
                    <PortalAssessmentPill status={c.assessmentStatus} />
                    <div className="flex gap-2">
                      <Link
                        href={`/portal/clients/${c.id}`}
                        className="rounded-lg bg-[var(--espresso)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                      >
                        Open
                      </Link>
                      {c.assessmentId ? (
                        <Link
                          href={`/portal/clients/${c.id}/assessments/${c.assessmentId}`}
                          className="rounded-lg border border-[var(--portal-line)] px-3 py-1.5 text-xs font-medium text-[var(--espresso)] hover:bg-[var(--portal-paper)]"
                        >
                          Preview
                        </Link>
                      ) : null}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        <aside className="space-y-6">
          <PortalInboxCard
            items={data.inbox.items}
            unreadCount={data.inbox.unreadCount}
          />

          <div className="rounded-[16px] bg-[var(--espresso)] p-5 text-[#F3EADD] shadow-[var(--portal-shadow)]">
            <h2 className="font-display text-lg font-semibold">
              Assessment progress
            </h2>
            <p className="mt-1 text-sm text-[#F3EADD]/75">
              Signed and completed vs. caseload size.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <CompletionRing pct={data.caseloadCompletionPct} />
              <ul className="space-y-1.5 text-sm">
                <li>
                  <span className="text-[#F3EADD]/70">In progress</span>{' '}
                  <strong className="font-display">
                    {data.assessmentMix.inProgress}
                  </strong>
                </li>
                <li>
                  <span className="text-[#F3EADD]/70">Completed</span>{' '}
                  <strong className="font-display">
                    {data.assessmentMix.completed}
                  </strong>
                </li>
                <li>
                  <span className="text-[#F3EADD]/70">Signed</span>{' '}
                  <strong className="font-display">
                    {data.assessmentMix.signed}
                  </strong>
                </li>
              </ul>
            </div>
            {data.actionQueue[0] ? (
              <p className={cn('mt-4 border-t border-white/10 pt-3 text-xs text-[#F3EADD]/80')}>
                Next up: {data.actionQueue[0].clientName} — {data.actionQueue[0].reason}
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  )
}
