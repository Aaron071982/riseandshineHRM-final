import ScheduleWorkspace from '@/components/schedule/ScheduleWorkspace'
import { syncTherapistBoroughsFromRbtProfiles } from '@/lib/schedule/syncTherapistBoroughs'
import {
  getLatestPeriodRange,
  listSchedulePeriods,
  loadPeriodWorkspaceData,
} from '@/lib/schedule-import/periodData'

export const dynamic = 'force-dynamic'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: { periodStart?: string; periodEnd?: string; borough?: string }
}) {
  await syncTherapistBoroughsFromRbtProfiles().catch(() => 0)

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

  const [data, periods] = await Promise.all([
    loadPeriodWorkspaceData({
      periodStart,
      periodEnd,
      boroughFilter: searchParams?.borough || null,
    }),
    listSchedulePeriods(),
  ])

  return (
    <ScheduleWorkspace
      initial={data}
      periods={periods}
      initialBorough={searchParams?.borough || ''}
    />
  )
}
