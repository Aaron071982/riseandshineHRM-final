import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getClientServicesPageUser } from '@/lib/crm/access'
import { isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'
import { loadBcbaPortalDashboard } from '@/lib/crm/bcbaPortalDashboard'
import { formatCalendarDate } from '@/lib/billing/calendarDate'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PILL: Record<string, string> = {
  DRAFT: 'bg-[color-mix(in_srgb,var(--line)_80%,white)] text-[var(--muted-ink)]',
  IN_PROGRESS: 'bg-[color-mix(in_srgb,var(--sunrise)_18%,white)] text-[var(--espresso)]',
  COMPLETED: 'bg-[color-mix(in_srgb,var(--stage-clinical)_18%,white)] text-[var(--espresso)]',
  SIGNED: 'bg-[color-mix(in_srgb,var(--espresso)_12%,white)] text-[var(--espresso)]',
}

function label(status: string) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

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
      <header className="space-y-1 border-b border-line pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sunrise)]">
          Assessments
        </p>
        <h1 className="font-display text-3xl font-semibold text-[var(--espresso)]">
          Your assessment library
        </h1>
        <p className="max-w-2xl text-[var(--muted-ink)]">
          Work in progress and completed assessments across your caseload.
          Preview or download any form you&apos;ve authored.
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
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-[var(--espresso)]">
            Clients without an assessment
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.clients
              .filter((c) => !c.assessmentId)
              .map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/portal/clients/${c.id}?tab=assessment`}
                    className="block rounded-xl border border-line px-3 py-2.5 text-sm hover:bg-canvas"
                  >
                    <span className="font-medium text-[var(--espresso)]">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="mt-0.5 block text-quiet">{c.clientCode}</span>
                  </Link>
                </li>
              ))}
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
    <div className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-xl font-semibold text-[var(--espresso)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-quiet">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas/80 text-quiet">
            <tr>
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Updated</th>
              <th className="px-3 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-line/70">
                <td className="px-5 py-3">
                  <Link
                    href={`/portal/clients/${a.clientId}?tab=assessment`}
                    className="font-medium text-[var(--espresso)] hover:text-[var(--sunrise)]"
                  >
                    {a.clientName}
                  </Link>
                  <span className="mt-0.5 block text-xs text-quiet">
                    {a.clientCode}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize',
                      PILL[a.status] ?? 'bg-canvas text-quiet'
                    )}
                  >
                    {label(a.status)}
                  </span>
                </td>
                <td className="px-3 py-3 text-quiet">
                  {formatCalendarDate(a.updatedAt)}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/portal/clients/${a.clientId}/assessments/${a.id}`}
                      className="text-xs font-medium underline-offset-2 hover:underline"
                    >
                      {a.status === 'SIGNED' || a.status === 'COMPLETED'
                        ? 'View'
                        : 'Continue'}
                    </Link>
                    <span className="text-line">·</span>
                    {a.source === 'UPLOAD' ? (
                      <a
                        href={`/api/client-services/clients/${a.clientId}/assessments/${a.id}/download`}
                        className="text-xs font-medium text-[var(--sunrise)] underline-offset-2 hover:underline"
                      >
                        Download
                      </a>
                    ) : (
                      <Link
                        href={`/portal/clients/${a.clientId}/assessments/${a.id}/print`}
                        className="text-xs font-medium text-[var(--sunrise)] underline-offset-2 hover:underline"
                        target="_blank"
                      >
                        Preview / PDF
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-quiet">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
