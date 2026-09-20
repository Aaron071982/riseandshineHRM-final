import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getClientServicesPageUser } from '@/lib/crm/access'
import { isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'
import { loadBcbaPortalDashboard } from '@/lib/crm/bcbaPortalDashboard'
import { formatCalendarDate } from '@/lib/billing/calendarDate'
import {
  PortalAssessmentPill,
  PortalAvatar,
} from '@/components/portal/PortalUi'

export const dynamic = 'force-dynamic'

export default async function PortalAssessmentsPage() {
  const user = await getClientServicesPageUser()
  if (!user) return null
  if (!isClinicalSurfaceOnly(user)) redirect('/client-services')

  const data = await loadBcbaPortalDashboard(user)
  const todo = data.assessments.filter(
    (a) => a.status === 'DRAFT' || a.status === 'IN_PROGRESS'
  )
  const done = data.assessments.filter(
    (a) => a.status === 'COMPLETED' || a.status === 'SIGNED'
  )

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-1 pb-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--portal-orange-deep)]">
          Assessments
        </p>
        <h1 className="font-display text-3xl font-semibold text-[var(--espresso)] sm:text-4xl">
          Your assessment library
        </h1>
        <p className="max-w-2xl text-[var(--muted-ink)]">
          Work in progress and completed assessments across your caseload.
        </p>
      </header>

      <section className="grid gap-6 xl:grid-cols-2">
        <AssessmentTable
          title="To do"
          subtitle="Draft and in-progress assessments"
          rows={todo}
          empty="No open assessments — nice work."
        />
        <AssessmentTable
          title="Completed"
          subtitle="Completed and signed copies you can preview or download"
          rows={done}
          empty="No completed assessments yet."
        />
      </section>

      {data.clients.some((c) => !c.assessmentId) ? (
        <section className="rounded-[16px] border border-[var(--portal-line)] bg-white p-5 shadow-[var(--portal-shadow)]">
          <h2 className="font-display text-lg font-semibold text-[var(--espresso)]">
            Clients without an assessment
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.clients
              .filter((c) => !c.assessmentId)
              .map((c) => {
                const name = `${c.firstName} ${c.lastName}`.trim()
                return (
                  <li key={c.id}>
                    <Link
                      href={`/portal/clients/${c.id}?tab=assessment`}
                      className="flex items-center gap-3 rounded-[14px] border border-[var(--portal-line)] px-3 py-2.5 text-sm transition-colors hover:bg-[var(--portal-paper)]"
                    >
                      <PortalAvatar name={name} className="h-8 w-8 text-[10px]" />
                      <span>
                        <span className="block font-medium text-[var(--espresso)]">
                          {name}
                        </span>
                        <span className="text-xs text-[var(--muted-ink)]">
                          {c.clientCode}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function AssessmentTable({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string
  subtitle: string
  rows: {
    id: string
    clientId: string
    clientName: string
    clientCode: string
    status: string
    source: string
    updatedAt: Date
  }[]
  empty: string
}) {
  return (
    <div className="rounded-[16px] border border-[var(--portal-line)] bg-white shadow-[var(--portal-shadow)]">
      <div className="border-b border-[var(--portal-line)] px-5 py-4">
        <h2 className="font-display text-xl font-semibold text-[var(--espresso)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-ink)]">{subtitle}</p>
      </div>
      <ul className="divide-y divide-[var(--portal-line)]">
        {rows.length === 0 ? (
          <li className="px-5 py-10 text-center text-sm text-[var(--muted-ink)]">
            {empty}
          </li>
        ) : (
          rows.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5"
            >
              <PortalAvatar name={a.clientName} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/portal/clients/${a.clientId}?tab=assessment`}
                  className="font-medium text-[var(--espresso)] hover:text-[var(--portal-orange)]"
                >
                  {a.clientName}
                </Link>
                <p className="text-xs text-[var(--muted-ink)]">
                  {a.clientCode} · {formatCalendarDate(a.updatedAt)}
                </p>
              </div>
              <PortalAssessmentPill status={a.status} />
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/portal/clients/${a.clientId}/assessments/${a.id}`}
                  className="rounded-lg bg-[var(--espresso)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                >
                  {a.status === 'SIGNED' || a.status === 'COMPLETED'
                    ? 'View'
                    : 'Continue'}
                </Link>
                {a.source === 'UPLOAD' ? (
                  <a
                    href={`/api/client-services/clients/${a.clientId}/assessments/${a.id}/download`}
                    className="rounded-lg border border-[var(--portal-line)] px-3 py-1.5 text-xs font-medium text-[var(--portal-orange)] hover:bg-[var(--portal-paper)]"
                  >
                    Download
                  </a>
                ) : (
                  <Link
                    href={`/portal/clients/${a.clientId}/assessments/${a.id}/print`}
                    className="rounded-lg border border-[var(--portal-line)] px-3 py-1.5 text-xs font-medium text-[var(--portal-orange)] hover:bg-[var(--portal-paper)]"
                    target="_blank"
                  >
                    Preview / PDF
                  </Link>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
