import type { DepartmentQueueData } from '@/lib/crm/departments'
import type { ClaimablePoolRow } from '@/lib/crm/claims'

/** Local client-name search for caseload / department queue views (no navigation). */
export function matchesClientSearch(
  row: { firstName: string; lastName: string; clientCode?: string | null },
  q: string
): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const full = `${row.firstName} ${row.lastName}`.toLowerCase()
  const code = row.clientCode?.toLowerCase() ?? ''
  return (
    full.includes(needle) ||
    (code && code.includes(needle)) ||
    row.firstName.toLowerCase().includes(needle) ||
    row.lastName.toLowerCase().includes(needle)
  )
}

function filterDeptRows<
  T extends { firstName: string; lastName: string; clientCode?: string },
>(rows: T[], q: string): T[] {
  if (!q.trim()) return rows
  return rows.filter((r) => matchesClientSearch(r, q))
}

function filterPoolRows(rows: ClaimablePoolRow[], q: string): ClaimablePoolRow[] {
  if (!q.trim()) return rows
  return rows.filter((r) => matchesClientSearch(r, q))
}

/** Filter department queue data in place — preserves section structure and tabs. */
export function filterDepartmentQueueData(
  data: DepartmentQueueData,
  q: string
): DepartmentQueueData {
  if (!q.trim()) return data
  return {
    ...data,
    unclaimed: filterPoolRows(data.unclaimed, q),
    unclaimedFull: data.unclaimedFull
      ? filterDeptRows(data.unclaimedFull, q)
      : null,
    claimed: filterDeptRows(data.claimed, q),
    upcoming: data.upcoming ? filterDeptRows(data.upcoming, q) : null,
    ready: data.ready ? filterDeptRows(data.ready, q) : null,
    unassignedCc: data.unassignedCc ? filterPoolRows(data.unassignedCc, q) : null,
    coordinatorGroups: data.coordinatorGroups
      ? data.coordinatorGroups.map((g) => ({
          ...g,
          ready: filterDeptRows(g.ready, q),
          upcoming: filterDeptRows(g.upcoming, q),
        }))
      : null,
    underHoursActive: data.underHoursActive
      ? filterDeptRows(data.underHoursActive, q)
      : null,
    needsMoreHoursActive: data.needsMoreHoursActive
      ? filterDeptRows(data.needsMoreHoursActive, q)
      : null,
  }
}
