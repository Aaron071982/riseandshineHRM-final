import Link from 'next/link'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { getClientServicesPageUser } from '@/lib/crm/access'
import { isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'
import { prisma } from '@/lib/prisma'
import { formatUsd } from '@/lib/billing/format'

export const dynamic = 'force-dynamic'

export default async function PortalPayPage() {
  const user = await getClientServicesPageUser()
  if (!user) return null
  if (!isClinicalSurfaceOnly(user)) redirect('/client-services')

  const contractor = await prisma.contractorProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })

  const stubs = contractor
    ? await prisma.payStatement.findMany({
        where: {
          contractorId: contractor.id,
          payeeType: 'BCBA',
          status: 'SENT',
        },
        include: {
          payPeriod: true,
        },
        orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      })
    : []

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-none">
      <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--sunrise)]">
        Pay stubs
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--espresso)]">
        Your pay stubs
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--muted-ink)]">
        Pay statements published to you by payroll. Only your own sent
        statements appear here.
      </p>

      {stubs.length === 0 ? (
        <div className="mt-10 rounded-xl border border-line bg-surface px-5 py-10 text-center">
          <p className="text-[var(--espresso)] font-medium">
            No pay stubs yet — they&apos;ll appear here once sent.
          </p>
          <Link
            href="/portal"
            className="mt-6 inline-flex rounded-lg border border-line bg-canvas px-4 py-2 text-sm font-medium text-[var(--espresso)] hover:bg-surface"
          >
            Back to clients
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted-ink)] bg-canvas">
                <th className="px-4 py-3 font-medium">Pay period</th>
                <th className="px-4 py-3 font-medium">Pay date</th>
                <th className="px-4 py-3 font-medium text-right">Net pay</th>
                <th className="px-4 py-3 font-medium text-right">Download</th>
              </tr>
            </thead>
            <tbody>
              {stubs.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-[var(--espresso)]">
                    {s.payPeriod.label}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-ink)]">
                    {format(s.payPeriod.payDate, 'MMM d, yyyy')}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-display font-semibold tabular-nums"
                    style={{ color: '#2E6B57' }}
                  >
                    {formatUsd(Number(s.netPay))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/payroll/statements/${s.id}/download`}
                      className="text-sm font-medium text-[var(--sunrise)] underline-offset-2 hover:underline"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  )
}
