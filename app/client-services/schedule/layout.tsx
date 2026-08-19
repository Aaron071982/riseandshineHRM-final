import {
  canAccessCrmSchedule,
  getClientServicesPageUser,
} from '@/lib/crm/access'

export const dynamic = 'force-dynamic'

export default async function CrmScheduleSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getClientServicesPageUser()
  if (!user) return null
  if (!canAccessCrmSchedule(user)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--urgent)] bg-[var(--urgent-bg)] px-5 py-8 text-center">
        <h1 className="font-display text-lg font-semibold text-[var(--urgent)]">
          403 — Schedule access required
        </h1>
        <p className="mt-2 text-sm text-ink">
          The weekly schedule is available to Staffing, Case Coordination, and
          full-access users.
        </p>
      </div>
    )
  }
  return children
}
