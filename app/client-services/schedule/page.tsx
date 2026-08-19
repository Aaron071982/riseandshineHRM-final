import ScheduleWorkspace from '@/components/schedule/ScheduleWorkspace'
import BoardMigrationReviewPanel from '@/components/crm/BoardMigrationReviewPanel'
import {
  canAccessCrmSchedule,
  getClientServicesPageUser,
  getVisibleClientsWhere,
  isFullAccess,
} from '@/lib/crm/access'
import {
  getLatestPeriodRange,
  listSchedulePeriods,
  loadPeriodWorkspaceData,
} from '@/lib/schedule-import/periodData'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function CrmSchedulePage({
  searchParams,
}: {
  searchParams?: { periodStart?: string; periodEnd?: string; borough?: string }
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

  const parse = (s?: string) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  let periodStart = parse(searchParams?.periodStart)
  let periodEnd = parse(searchParams?.periodEnd)
  if (!periodStart || !periodEnd) {
    const latest = await getLatestPeriodRange()
    if (latest) {
      periodStart = latest.periodStart
      periodEnd = latest.periodEnd
    }
  }

  let liveClientIds: string[] | 'ALL' = 'ALL'
  if (!isFullAccess(user)) {
    const rows = await prisma.serviceClient.findMany({
      where: { ...getVisibleClientsWhere(user), pipelineStatus: 'LIVE' },
      select: { id: true },
    })
    liveClientIds = rows.map((r) => r.id)
  }

  const [data, periods] = await Promise.all([
    loadPeriodWorkspaceData({
      periodStart,
      periodEnd,
      boroughFilter: searchParams?.borough || null,
      liveClientIds,
    }),
    listSchedulePeriods(),
  ])

  return (
    <div className="space-y-6">
      {user.fullAccess ? <BoardMigrationReviewPanel /> : null}
      <ScheduleWorkspace
        initial={data}
        periods={periods}
        initialBorough={searchParams?.borough || ''}
      />
    </div>
  )
}
