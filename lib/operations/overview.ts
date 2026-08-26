import type { CrmUser } from '@/lib/crm/access'
import { getVisibleClientsWhere } from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'
import { STAGE_LABELS, LINEAR_STAGE_ORDER } from '@/lib/crm/stages'
import {
  authBandLabel,
  authExpiryBand,
  daysUntilExpiry,
  isInAuthAttentionWindow,
  type AuthBandLabel,
} from '@/lib/operations/authBands'
import { logOpsReportRun } from '@/lib/operations/audit'

export type OpsOverviewData = {
  refreshedAt: string
  funnel: { stage: string; stageKey: string; count: number }[]
  staffing: {
    activeTotal: number
    activeStaffed: number
    activeUnstaffed: number
    pctStaffed: number | null
  }
  intakesByWeek: { week: string; count: number }[]
  authBands: {
    band: string
    assessment: number
    treatment: number
  }[]
  deptLoad: { name: string; count: number }[]
  ccLoad: { name: string; count: number }[]
  gaps: string[]
}

function mondayWeekKey(d: Date): string {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() + diff)
  return x.toISOString().slice(0, 10)
}

export async function loadOpsOverview(user: CrmUser): Promise<OpsOverviewData> {
  const visible = getVisibleClientsWhere(user)
  const now = new Date()
  const twelveWeeksAgo = new Date(now)
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7)

  const [liveClients, activeClients, auths, intakes, dueReactivateCount] =
    await Promise.all([
    prisma.serviceClient.findMany({
      where: { AND: [visible, { pipelineStatus: 'LIVE' }] },
      select: {
        stage: true,
        currentOwnerDept: true,
        caseCoordinatorUser: { select: { name: true, email: true } },
        caseCoordinatorName: true,
        caseCoordinatorUserId: true,
        scheduleAssignments: {
          where: { deletedAt: null, isActive: true },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.serviceClient.findMany({
      where: { AND: [visible, { pipelineStatus: 'LIVE', stage: 'ACTIVE' }] },
      select: {
        id: true,
        scheduleAssignments: {
          where: { deletedAt: null, isActive: true },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.clientAuthorization.findMany({
      where: {
        deletedAt: null,
        expirationDate: { not: null },
        serviceClient: visible,
      },
      select: { authType: true, expirationDate: true },
    }),
    prisma.serviceClient.findMany({
      where: { AND: [visible, { createdAt: { gte: twelveWeeksAgo } }] },
      select: { createdAt: true },
    }),
    prisma.rBTProfile.count({
      where: {
        activityState: 'INACTIVE',
        inactiveUntil: { lt: now },
        status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] },
      },
    }),
  ])

  await logOpsReportRun({
    actorUserId: user.id,
    reportKey: 'overview',
    rowCount: liveClients.length,
    kind: 'overview',
  })

  const stageCounts = new Map<string, number>()
  for (const c of liveClients) {
    stageCounts.set(c.stage, (stageCounts.get(c.stage) ?? 0) + 1)
  }
  const funnel = LINEAR_STAGE_ORDER.map((stage) => ({
    stage: STAGE_LABELS[stage],
    stageKey: stage,
    count: stageCounts.get(stage) ?? 0,
  }))

  const activeTotal = activeClients.length
  const activeUnstaffed = activeClients.filter(
    (c) => c.scheduleAssignments.length === 0
  ).length
  const activeStaffed = activeTotal - activeUnstaffed

  const weekMap = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    weekMap.set(mondayWeekKey(d), 0)
  }
  for (const c of intakes) {
    const key = mondayWeekKey(c.createdAt)
    if (weekMap.has(key)) weekMap.set(key, (weekMap.get(key) ?? 0) + 1)
  }

  const bandKeys: AuthBandLabel[] = ['expired', 0, 7, 14, 30, 45]
  const bandSplit = Object.fromEntries(
    bandKeys.map((b) => [String(b), { assessment: 0, treatment: 0 }])
  ) as Record<string, { assessment: number; treatment: number }>

  for (const a of auths) {
    if (!a.expirationDate) continue
    const days = daysUntilExpiry(a.expirationDate, now)
    if (!isInAuthAttentionWindow(days)) continue
    const band = String(authExpiryBand(days))
    if (!bandSplit[band]) continue
    if (a.authType === 'ASSESSMENT') bandSplit[band].assessment += 1
    else bandSplit[band].treatment += 1
  }

  const deptMap = new Map<string, number>()
  const ccMap = new Map<string, number>()
  for (const c of liveClients) {
    const dept = c.currentOwnerDept ?? 'UNASSIGNED'
    deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1)
    const cc =
      c.caseCoordinatorUser?.name ||
      c.caseCoordinatorUser?.email ||
      c.caseCoordinatorName ||
      'Unassigned'
    ccMap.set(cc, (ccMap.get(cc) ?? 0) + 1)
  }

  return {
    refreshedAt: new Date().toISOString(),
    funnel,
    staffing: {
      activeTotal,
      activeStaffed,
      activeUnstaffed,
      pctStaffed:
        activeTotal === 0
          ? null
          : Math.round((activeStaffed / activeTotal) * 100),
    },
    intakesByWeek: [...weekMap.entries()].map(([week, count]) => ({
      week,
      count,
    })),
    authBands: bandKeys.map((b) => ({
      band: authBandLabel(b),
      assessment: bandSplit[String(b)]?.assessment ?? 0,
      treatment: bandSplit[String(b)]?.treatment ?? 0,
    })),
    deptLoad: [...deptMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    ccLoad: [...ccMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    gaps: [
      'Client preferred language is not tracked on service_clients.',
      'Stage-at-send for Email Activity uses current client stage (historical stage at send time is not stored).',
      ...(dueReactivateCount > 0
        ? [
            `${dueReactivateCount} inactive RBT(s) past inactiveUntil — due to reactivate (manual; not auto-reactivated).`,
          ]
        : []),
    ],
  }
}
