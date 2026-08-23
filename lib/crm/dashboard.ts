import type { ClientStage, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getVisibleClientsWhere,
  isFullAccess,
  auditClientAction,
  type CrmUser,
} from '@/lib/crm/access'
import type { SessionUser } from '@/lib/auth'
import { LINEAR_STAGE_ORDER, STAGE_LABELS } from '@/lib/crm/stages'
import {
  AUTH_EXPIRY_BANDS,
  PRE_ACTIVE_STAGES,
  authExpiryBefore,
  contactAgingBefore,
  inquiryUncontactedBefore,
  stageStaleBefore,
  taskOverdueBefore,
} from '@/lib/crm/thresholds'

type DashUser = CrmUser | SessionUser

function scope(user: DashUser): Prisma.ServiceClientWhereInput {
  return getVisibleClientsWhere(user)
}

function liveScope(user: DashUser): Prisma.ServiceClientWhereInput {
  return { ...scope(user), pipelineStatus: 'LIVE' }
}

export type PipelineCounts = {
  byStage: { stage: ClientStage; label: string; count: number; stalled: number }[]
  inPipeline: number
  active: number
  onHold: number
  discharged: number
  lost: number
  total: number
}

export async function getPipelineCounts(user: DashUser): Promise<PipelineCounts> {
  const base = scope(user)

  const [stageGroups, pipelineGroups, stalledByStage] = await Promise.all([
    prisma.serviceClient.groupBy({
      by: ['stage'],
      where: { ...base, pipelineStatus: 'LIVE' },
      _count: { _all: true },
    }),
    prisma.serviceClient.groupBy({
      by: ['pipelineStatus'],
      where: base,
      _count: { _all: true },
    }),
    Promise.all(
      PRE_ACTIVE_STAGES.map(async (stage) => ({
        stage,
        count: await prisma.serviceClient.count({
          where: {
            ...base,
            pipelineStatus: 'LIVE',
            stage,
            stageEnteredAt: { lt: stageStaleBefore(stage) },
          },
        }),
      }))
    ),
  ])

  const stageMap = new Map(stageGroups.map((g) => [g.stage, g._count._all]))
  const stalledMap = new Map(stalledByStage.map((s) => [s.stage, s.count]))
  const pipeMap = new Map(
    pipelineGroups.map((g) => [g.pipelineStatus, g._count._all])
  )

  const byStage = LINEAR_STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: stageMap.get(stage) ?? 0,
    stalled: stalledMap.get(stage) ?? 0,
  }))

  // Legacy TREATMENT_PLAN rows still count toward pipeline totals
  const treatmentPlanCount = stageMap.get('TREATMENT_PLAN') ?? 0

  const inPipeline = byStage
    .filter((s) => s.stage !== 'ACTIVE')
    .reduce((n, s) => n + s.count, 0) + treatmentPlanCount
  const active = stageMap.get('ACTIVE') ?? 0

  return {
    byStage,
    inPipeline,
    active,
    onHold: pipeMap.get('ON_HOLD') ?? 0,
    discharged: pipeMap.get('DISCHARGED') ?? 0,
    lost: pipeMap.get('LOST') ?? 0,
    total: [...pipeMap.values()].reduce((a, b) => a + b, 0),
  }
}

export type DepartmentQueues = {
  intake: {
    newInquiries: number
    uncontacted: number
    missingDocuments: number
  }
  clinical: {
    waitingAssessment: number
    assessmentOverdue: number
    treatmentPlanPending: number
  }
  billing: {
    pending: number
    denied: number
    expiring60: number
  }
  staffing: {
    ready: number
    rbtSearch: number
    rbtSearchMaxDays: number
    rbtSearchAvgDays: number
    rbtAssigned: number
  }
  scheduling: {
    schedulePending: number
    startDatePending: number
  }
  active: {
    activeClients: number
    rbtReplacement: number
    serviceGaps: number
    authExpiring: number
  }
}

export async function getDepartmentQueues(
  user: DashUser
): Promise<DepartmentQueues> {
  const base = scope(user)
  const live = liveScope(user)
  const now = new Date()
  const uncontactedBefore = inquiryUncontactedBefore(now)
  const assessmentStale = stageStaleBefore('ASSESSMENT', now)
  const exp60 = authExpiryBefore(60, now)

  const [
    newInquiries,
    uncontacted,
    missingDocuments,
    waitingAssessment,
    assessmentOverdue,
    treatmentPlanPending,
    authPending,
    authDenied,
    authExpiring,
    ready,
    rbtSearch,
    rbtAssigned,
    schedulePending,
    startDatePending,
    activeClients,
    rbtReplacement,
    serviceGaps,
    searchAging,
  ] = await Promise.all([
    prisma.serviceClient.count({
      where: { ...live, stage: 'INQUIRY' },
    }),
    prisma.serviceClient.count({
      where: {
        ...live,
        stage: 'INQUIRY',
        OR: [
          { lastParentContactAt: null },
          { lastParentContactAt: { lt: uncontactedBefore } },
        ],
      },
    }),
    prisma.clientRequirement.groupBy({
      by: ['serviceClientId'],
      where: {
        type: 'DOCUMENT',
        status: { in: ['PENDING', 'MISSING', 'EXPIRED'] },
        serviceClient: { is: live },
      },
    }).then((rows) => rows.length),
    prisma.serviceClient.count({
      where: { ...live, stage: 'ASSESSMENT' },
    }),
    prisma.serviceClient.count({
      where: {
        ...live,
        stage: 'ASSESSMENT',
        stageEnteredAt: { lt: assessmentStale },
      },
    }),
    prisma.serviceClient.count({
      where: {
        ...live,
        treatmentPlanStatus: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        stage: {
          in: [
            'ASSESSMENT',
            'AUTHORIZATION',
            'APPROVED',
            'READY_FOR_STAFFING',
            'RBT_SEARCH',
            'RBT_ASSIGNED',
            'SCHEDULE_COORDINATION',
            'SCHEDULE_CONFIRMED',
            'PRE_START',
            'TREATMENT_PLAN',
          ],
        },
      },
    }),
    prisma.serviceClient.count({
      where: {
        ...live,
        OR: [
          { stage: 'AUTHORIZATION' },
          {
            authorizations: {
              some: { status: { in: ['REQUESTED', 'PENDING'] } },
            },
          },
        ],
      },
    }),
    prisma.clientAuthorization.groupBy({
      by: ['serviceClientId'],
      where: {
        status: 'DENIED',
        serviceClient: { is: live },
      },
    }).then((rows) => rows.length),
    prisma.clientAuthorization.groupBy({
      by: ['serviceClientId'],
      where: {
        authType: 'TREATMENT',
        status: 'APPROVED',
        expirationDate: { lte: exp60, gte: now },
        serviceClient: { is: { ...live, stage: 'ACTIVE' } },
      },
    }).then((rows) => rows.length),
    prisma.serviceClient.count({
      where: { ...live, stage: 'READY_FOR_STAFFING' },
    }),
    prisma.serviceClient.count({
      where: { ...live, stage: 'RBT_SEARCH' },
    }),
    prisma.serviceClient.count({
      where: { ...live, stage: 'RBT_ASSIGNED' },
    }),
    prisma.serviceClient.count({
      where: { ...live, stage: 'SCHEDULE_COORDINATION' },
    }),
    prisma.serviceClient.count({
      where: {
        ...live,
        stage: { in: ['SCHEDULE_CONFIRMED', 'PRE_START'] },
        actualServiceStartDate: null,
      },
    }),
    prisma.serviceClient.count({
      where: { ...live, stage: 'ACTIVE' },
    }),
    prisma.clientAlert.count({
      where: {
        alertType: 'RBT_REPLACEMENT_NEEDED',
        resolvedAt: null,
        serviceClient: { is: live },
      },
    }),
    prisma.serviceClient.count({
      where: {
        ...base,
        OR: [
          { pipelineStatus: 'ON_HOLD' },
          {
            serviceBreaks: { some: { status: 'ON_BREAK' } },
          },
          {
            rbtBreaks: { some: { status: 'ON_BREAK' } },
          },
        ],
      },
    }),
    prisma.serviceClient.findMany({
      where: { ...live, stage: 'RBT_SEARCH', stageEnteredAt: { not: null } },
      select: { stageEnteredAt: true },
    }),
  ])

  const ages = searchAging.map((c) =>
    Math.max(
      0,
      Math.floor(
        (now.getTime() - (c.stageEnteredAt?.getTime() ?? now.getTime())) /
          (24 * 60 * 60 * 1000)
      )
    )
  )
  const rbtSearchMaxDays = ages.length ? Math.max(...ages) : 0
  const rbtSearchAvgDays = ages.length
    ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
    : 0

  return {
    intake: { newInquiries, uncontacted, missingDocuments },
    clinical: {
      waitingAssessment,
      assessmentOverdue,
      treatmentPlanPending,
    },
    billing: {
      pending: authPending,
      denied: authDenied,
      expiring60: authExpiring,
    },
    staffing: {
      ready,
      rbtSearch,
      rbtSearchMaxDays,
      rbtSearchAvgDays,
      rbtAssigned,
    },
    scheduling: { schedulePending, startDatePending },
    active: {
      activeClients,
      rbtReplacement,
      serviceGaps,
      authExpiring,
    },
  }
}

export type ActiveHealth = {
  authExpiring: {
    band: number
    items: {
      clientId: string
      clientName: string
      clientCode: string
      payerName: string
      expirationDate: string
      daysLeft: number
    }[]
  }[]
  rbtReplacement: {
    alertId: string
    clientId: string
    clientName: string
    clientCode: string
    message: string
    createdAt: string
  }[]
  onBreak: {
    clientId: string
    clientName: string
    clientCode: string
    kind: 'client' | 'rbt' | 'pipeline'
    detail: string
    expectedReturnDate: string | null
  }[]
}

export async function getActiveHealth(user: DashUser): Promise<ActiveHealth> {
  const live = liveScope(user)
  const base = scope(user)
  const now = new Date()
  const exp60 = authExpiryBefore(60, now)

  const [auths, alerts, onHoldClients, clientBreaks, rbtBreaks] =
    await Promise.all([
      prisma.clientAuthorization.findMany({
        where: {
          authType: 'TREATMENT',
          status: 'APPROVED',
          expirationDate: { lte: exp60, gte: now },
          serviceClient: { is: { ...live, stage: 'ACTIVE' } },
        },
        select: {
          payerName: true,
          expirationDate: true,
          serviceClient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clientCode: true,
            },
          },
        },
        orderBy: { expirationDate: 'asc' },
        take: 50,
      }),
      prisma.clientAlert.findMany({
        where: {
          alertType: 'RBT_REPLACEMENT_NEEDED',
          resolvedAt: null,
          serviceClient: { is: live },
        },
        select: {
          id: true,
          message: true,
          createdAt: true,
          serviceClient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clientCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.serviceClient.findMany({
        where: { ...base, pipelineStatus: 'ON_HOLD' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientCode: true,
        },
        take: 40,
      }),
      prisma.clientServiceBreak.findMany({
        where: { status: 'ON_BREAK', serviceClient: { is: base } },
        select: {
          expectedReturnDate: true,
          reason: true,
          serviceClient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clientCode: true,
            },
          },
        },
        take: 40,
      }),
      prisma.clientRbtBreak.findMany({
        where: { status: 'ON_BREAK', serviceClient: { is: base } },
        select: {
          btName: true,
          expectedReturnDate: true,
          coverageNotes: true,
          serviceClient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clientCode: true,
            },
          },
        },
        take: 40,
      }),
    ])

  const banded = AUTH_EXPIRY_BANDS.map((band) => ({
    band,
    items: [] as ActiveHealth['authExpiring'][number]['items'],
  }))

  for (const a of auths) {
    if (!a.expirationDate) continue
    const daysLeft = Math.ceil(
      (a.expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    )
    const item = {
      clientId: a.serviceClient.id,
      clientName: `${a.serviceClient.firstName} ${a.serviceClient.lastName}`.trim(),
      clientCode: a.serviceClient.clientCode,
      payerName: a.payerName,
      expirationDate: a.expirationDate.toISOString(),
      daysLeft,
    }
    // Place in tightest matching band
    let placed = false
    for (const b of [...AUTH_EXPIRY_BANDS].sort((x, y) => x - y)) {
      if (daysLeft <= b) {
        banded.find((x) => x.band === b)!.items.push(item)
        placed = true
        break
      }
    }
    if (!placed) banded[0].items.push(item)
  }

  const onBreak: ActiveHealth['onBreak'] = []
  for (const c of onHoldClients) {
    onBreak.push({
      clientId: c.id,
      clientName: `${c.firstName} ${c.lastName}`.trim(),
      clientCode: c.clientCode,
      kind: 'pipeline',
      detail: 'Pipeline on hold',
      expectedReturnDate: null,
    })
  }
  for (const b of clientBreaks) {
    onBreak.push({
      clientId: b.serviceClient.id,
      clientName: `${b.serviceClient.firstName} ${b.serviceClient.lastName}`.trim(),
      clientCode: b.serviceClient.clientCode,
      kind: 'client',
      detail: `Client break (${b.reason})`,
      expectedReturnDate: b.expectedReturnDate.toISOString(),
    })
  }
  for (const b of rbtBreaks) {
    onBreak.push({
      clientId: b.serviceClient.id,
      clientName: `${b.serviceClient.firstName} ${b.serviceClient.lastName}`.trim(),
      clientCode: b.serviceClient.clientCode,
      kind: 'rbt',
      detail: `RBT break — ${b.btName}`,
      expectedReturnDate: b.expectedReturnDate.toISOString(),
    })
  }

  return {
    authExpiring: banded,
    rbtReplacement: alerts.map((a) => ({
      alertId: a.id,
      clientId: a.serviceClient.id,
      clientName: `${a.serviceClient.firstName} ${a.serviceClient.lastName}`.trim(),
      clientCode: a.serviceClient.clientCode,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    })),
    onBreak,
  }
}

export type PerformanceRow = {
  userId: string
  name: string
  email: string | null
  assigned: number
  completed: number
  overdueTasks: number
  avgDaysPerStage: number | null
  followUpsDue: number
  stalled: number
}

export async function getPerformance(user: DashUser): Promise<PerformanceRow[]> {
  const base = scope(user)
  const live = liveScope(user)
  const now = new Date()
  const contactBefore = contactAgingBefore(now)
  const overdueAt = taskOverdueBefore(now)

  // Coordinator IDs in scope
  const coordGroups = await prisma.serviceClient.groupBy({
    by: ['caseCoordinatorUserId'],
    where: {
      ...base,
      caseCoordinatorUserId: { not: null },
      ...(isFullAccess(user) ? {} : { caseCoordinatorUserId: user.id }),
    },
    _count: { _all: true },
  })

  const coordIds = coordGroups
    .map((g) => g.caseCoordinatorUserId)
    .filter((id): id is string => !!id)

  if (coordIds.length === 0) return []

  const [users, completedGroups, overdueTaskGroups, historyAvgs, followUps, stalledClients] =
    await Promise.all([
      prisma.user.findMany({
        where: { id: { in: coordIds } },
        select: { id: true, name: true, email: true },
      }),
      prisma.serviceClient.groupBy({
        by: ['caseCoordinatorUserId'],
        where: {
          caseCoordinatorUserId: { in: coordIds },
          stage: 'ACTIVE',
          pipelineStatus: 'LIVE',
        },
        _count: { _all: true },
      }),
      prisma.teamTask.groupBy({
        by: ['assignedToUserId'],
        where: {
          status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
          dueAt: { lt: overdueAt },
          assignedToUserId: { in: coordIds },
          serviceClient: { is: base },
        },
        _count: { _all: true },
      }),
      prisma.serviceClientStatusHistory.groupBy({
        by: ['changedBy'],
        where: {
          changedBy: { in: coordIds },
          durationSeconds: { not: null },
          serviceClient: { is: base },
        },
        _avg: { durationSeconds: true },
      }),
      prisma.serviceClient.groupBy({
        by: ['caseCoordinatorUserId'],
        where: {
          ...live,
          caseCoordinatorUserId: { in: coordIds },
          OR: [
            { lastParentContactAt: null },
            { lastParentContactAt: { lt: contactBefore } },
          ],
        },
        _count: { _all: true },
      }),
      // Stalled: fetch lightweight rows for scoped coords only
      prisma.serviceClient.findMany({
        where: {
          ...live,
          caseCoordinatorUserId: { in: coordIds },
          stage: { not: 'ACTIVE' },
          stageEnteredAt: { not: null },
        },
        select: {
          caseCoordinatorUserId: true,
          stage: true,
          stageEnteredAt: true,
        },
      }),
    ])

  const { isStalled } = await import('@/lib/crm/thresholds')
  const stalledByCoord = new Map<string, number>()
  for (const c of stalledClients) {
    if (!c.caseCoordinatorUserId || !isStalled(c)) continue
    stalledByCoord.set(
      c.caseCoordinatorUserId,
      (stalledByCoord.get(c.caseCoordinatorUserId) ?? 0) + 1
    )
  }

  const assignedMap = new Map(
    coordGroups.map((g) => [g.caseCoordinatorUserId!, g._count._all])
  )
  const completedMap = new Map(
    completedGroups.map((g) => [g.caseCoordinatorUserId!, g._count._all])
  )
  const overdueMap = new Map(
    overdueTaskGroups.map((g) => [g.assignedToUserId!, g._count._all])
  )
  const avgMap = new Map(
    historyAvgs.map((g) => [g.changedBy!, g._avg.durationSeconds])
  )
  const followMap = new Map(
    followUps.map((g) => [g.caseCoordinatorUserId!, g._count._all])
  )
  const userMap = new Map(users.map((u) => [u.id, u]))

  return coordIds.map((id) => {
    const u = userMap.get(id)
    const avgSec = avgMap.get(id)
    return {
      userId: id,
      name: u?.name || u?.email || 'Coordinator',
      email: u?.email ?? null,
      assigned: assignedMap.get(id) ?? 0,
      completed: completedMap.get(id) ?? 0,
      overdueTasks: overdueMap.get(id) ?? 0,
      avgDaysPerStage:
        avgSec != null ? Math.round((avgSec / 86400) * 10) / 10 : null,
      followUpsDue: followMap.get(id) ?? 0,
      stalled: stalledByCoord.get(id) ?? 0,
    }
  })
}

export type DashboardKpis = {
  inPipeline: number
  activeClients: number
  needsAttention: number
  authExpiring60: number
}

export async function getDashboardKpis(user: DashUser): Promise<DashboardKpis> {
  const pipe = await getPipelineCounts(user)
  const live = liveScope(user)
  const base = scope(user)
  const now = new Date()
  const exp60 = authExpiryBefore(60, now)
  const overdueAt = taskOverdueBefore(now)

  const [stalledTotal, unresolvedAlerts, overdueTasks, authExpiring60] =
    await Promise.all([
      Promise.all(
        PRE_ACTIVE_STAGES.map((stage) =>
          prisma.serviceClient.count({
            where: {
              ...live,
              stage,
              stageEnteredAt: { lt: stageStaleBefore(stage, now) },
            },
          })
        )
      ).then((ns) => ns.reduce((a, b) => a + b, 0)),
      prisma.clientAlert.count({
        where: { resolvedAt: null, serviceClient: { is: live } },
      }),
      prisma.teamTask.count({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
          dueAt: { lt: overdueAt },
          serviceClient: { is: base },
        },
      }),
      prisma.clientAuthorization.groupBy({
        by: ['serviceClientId'],
        where: {
          authType: 'TREATMENT',
          status: 'APPROVED',
          expirationDate: { lte: exp60, gte: now },
          serviceClient: { is: { ...live, stage: 'ACTIVE' } },
        },
      }).then((rows) => rows.length),
    ])

  return {
    inPipeline: pipe.inPipeline,
    activeClients: pipe.active,
    needsAttention: stalledTotal + unresolvedAlerts + overdueTasks,
    authExpiring60,
  }
}

export type ManagerDashboardData = {
  kpis: DashboardKpis
  pipeline: PipelineCounts
  queues: DepartmentQueues
  health: ActiveHealth
  performance: PerformanceRow[]
}

export async function loadManagerDashboard(
  user: DashUser
): Promise<ManagerDashboardData> {
  const live = liveScope(user)
  const base = scope(user)
  const now = new Date()
  const exp60 = authExpiryBefore(60, now)
  const overdueAt = taskOverdueBefore(now)

  const [pipeline, queues, health, performance, stalledTotal, unresolvedAlerts, overdueTasks, authExpiring60] =
    await Promise.all([
      getPipelineCounts(user),
      getDepartmentQueues(user),
      getActiveHealth(user),
      getPerformance(user),
      Promise.all(
        PRE_ACTIVE_STAGES.map((stage) =>
          prisma.serviceClient.count({
            where: {
              ...live,
              stage,
              stageEnteredAt: { lt: stageStaleBefore(stage, now) },
            },
          })
        )
      ).then((ns) => ns.reduce((a, b) => a + b, 0)),
      prisma.clientAlert.count({
        where: { resolvedAt: null, serviceClient: { is: live } },
      }),
      prisma.teamTask.count({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
          dueAt: { lt: overdueAt },
          serviceClient: { is: base },
        },
      }),
      prisma.clientAuthorization
        .groupBy({
          by: ['serviceClientId'],
          where: {
            authType: 'TREATMENT',
            status: 'APPROVED',
            expirationDate: { lte: exp60, gte: now },
            serviceClient: { is: { ...live, stage: 'ACTIVE' } },
          },
        })
        .then((rows) => rows.length),
    ])

  const kpis: DashboardKpis = {
    inPipeline: pipeline.inPipeline,
    activeClients: pipeline.active,
    needsAttention: stalledTotal + unresolvedAlerts + overdueTasks,
    authExpiring60,
  }

  await auditClientAction({
    userId: user.id,
    action: 'DASHBOARD_VIEW',
  })

  return { kpis, pipeline, queues, health, performance }
}
