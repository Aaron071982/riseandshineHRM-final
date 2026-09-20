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
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--portal-orange-deep)]">
          Pay stubs
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--espresso)] sm:text-4xl">
          Your pay stubs
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--muted-ink)]">
          Pay statements published to you by payroll. Only your own sent
          statements appear here.
        </p>

        {stubs.length === 0 ? (
          <div className="mt-10 rounded-[16px] border border-[var(--portal-line)] bg-white px-5 py-10 text-center shadow-[var(--portal-shadow)]">
            <p className="font-medium text-[var(--espresso)]">
              No pay stubs yet — they&apos;ll appear here once sent.
            </p>
            <Link
              href="/portal"
              className="mt-6 inline-flex rounded-lg border border-[var(--portal-line)] bg-[var(--portal-paper)] px-4 py-2 text-sm font-medium text-[var(--espresso)] hover:bg-white"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-[16px] border border-[var(--portal-line)] bg-white shadow-[var(--portal-shadow)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--portal-paper)] text-left text-[11px] uppercase tracking-wide text-[var(--muted-ink)]">
                  <th className="px-4 py-3 font-medium">Pay period</th>
                  <th className="px-4 py-3 font-medium">Pay date</th>
                  <th className="px-4 py-3 font-medium text-right">Net pay</th>
                  <th className="px-4 py-3 font-medium text-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {stubs.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--portal-line)]">
                    <td className="px-4 py-3 font-medium text-[var(--espresso)]">
                      {s.payPeriod.label}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-ink)]">
                      {format(s.payPeriod.payDate, 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right font-display font-semibold tabular-nums text-[var(--portal-money)]">
                      {formatUsd(Number(s.netPay))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/api/payroll/statements/${s.id}/download`}
                        className="inline-flex rounded-lg bg-[var(--portal-orange)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--portal-orange-deep)]"
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
