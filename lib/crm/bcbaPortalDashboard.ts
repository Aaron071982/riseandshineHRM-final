import type { CrmUser } from '@/lib/crm/access'
import { getVisibleClientsWhere } from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { derivePortalLifecycle } from '@/lib/crm/portalLifecycle'
import type { PortalLifecycleSnapshot } from '@/lib/crm/portalLifecycle'
import {
  listPortalInbox,
  type PortalInboxItem,
} from '@/lib/crm/portalNotifications'

export type BcbaPortalDashboard = {
  greetingName: string
  credentialsLine: string | null
  clientCount: number
  assessmentMix: {
    draft: number
    inProgress: number
    signed: number
    completed: number
  }
  readyToAssess: number
  authExpiring30: number
  reassessmentsDue: number
  caseloadCompletionPct: number
  actionQueue: {
    id: string
    clientId: string
    clientName: string
    clientCode: string
    reason: string
    assessmentId?: string | null
  }[]
  clients: {
    id: string
    clientCode: string
    firstName: string
    lastName: string
    dateOfBirth: Date | null
    stage: string
    assessmentStatus: string | null
    assessmentId: string | null
    nextReassessmentDate: Date | null
    authEndDate: Date | null
    updatedAt: Date
    lifecycle: PortalLifecycleSnapshot
  }[]
  assessments: {
    id: string
    clientId: string
    clientName: string
    clientCode: string
    status: string
    source: string
    updatedAt: Date
    signedAt: Date | null
  }[]
  inbox: {
    items: PortalInboxItem[]
    unreadCount: number
  }
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d)
  out.setUTCMonth(out.getUTCMonth() + months)
  return out
}

function nextReassessmentFrom(latest: {
  status: string
  signedAt: Date | null
  updatedAt: Date
} | null): Date | null {
  if (!latest) return null
  if (latest.status !== 'SIGNED' && latest.status !== 'COMPLETED') return null
  const anchor = latest.signedAt ?? latest.updatedAt
  return addMonths(anchor, 6)
}

export async function loadBcbaPortalDashboard(
  user: CrmUser
): Promise<BcbaPortalDashboard> {
  const where = getVisibleClientsWhere(user)

  const clients = await prisma.serviceClient.findMany({
    where,
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      stage: true,
      assignedBcbaId: true,
      updatedAt: true,
      authorizations: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { expirationDate: true },
      },
      treatmentAssessments: {
        where: { deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          source: true,
          updatedAt: true,
          signedAt: true,
        },
      },
      btAssignments: {
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
        take: 3,
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 200,
  })

  const assessmentMix = { draft: 0, inProgress: 0, signed: 0, completed: 0 }
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  let authExpiring30 = 0
  let reassessmentsDue = 0
  let readyToAssess = 0
  let finishedAssessments = 0
  const actionQueue: BcbaPortalDashboard['actionQueue'] = []
  const assessments: BcbaPortalDashboard['assessments'] = []

  const rows: BcbaPortalDashboard['clients'] = clients.map((c) => {
    const latest = c.treatmentAssessments[0] ?? null
    const status = latest?.status ?? null
    if (latest) {
      if (status === 'DRAFT') assessmentMix.draft += 1
      else if (status === 'IN_PROGRESS') assessmentMix.inProgress += 1
      else if (status === 'SIGNED') {
        assessmentMix.signed += 1
        finishedAssessments += 1
      } else if (status === 'COMPLETED') {
        assessmentMix.completed += 1
        finishedAssessments += 1
      }
    }

    const lifecycle = derivePortalLifecycle({
      stage: c.stage,
      assessmentStatus: status,
      hasTherapistAssigned: c.btAssignments.length > 0,
    })
    if (
      lifecycle.currentId === 'READY_FOR_ASSESSMENT' ||
      (lifecycle.stages[2] && !lifecycle.stages[2].done && lifecycle.stages[1]?.done)
    ) {
      if (!latest || status === 'DRAFT' || status === 'IN_PROGRESS') {
        readyToAssess += 1
      }
    }

    for (const a of c.treatmentAssessments) {
      assessments.push({
        id: a.id,
        clientId: c.id,
        clientName: `${c.firstName} ${c.lastName}`.trim(),
        clientCode: c.clientCode,
        status: a.status,
        source: a.source,
        updatedAt: a.updatedAt,
        signedAt: a.signedAt,
      })
    }

    const authEnd = c.authorizations[0]?.expirationDate ?? null
    if (authEnd && authEnd >= now && authEnd <= in30) {
      authExpiring30 += 1
      actionQueue.push({
        id: `auth-${c.id}`,
        clientId: c.id,
        clientName: `${c.firstName} ${c.lastName}`.trim(),
        clientCode: c.clientCode,
        reason: 'Authorization ends within 30 days',
        assessmentId: latest?.id ?? null,
      })
    }

    const nextReassessmentDate = nextReassessmentFrom(latest)
    if (latest && (latest.status === 'SIGNED' || latest.status === 'COMPLETED')) {
      const due = nextReassessmentDate!
      if (due <= in90) {
        reassessmentsDue += 1
        if (due <= now) {
          actionQueue.push({
            id: `reassess-${c.id}`,
            clientId: c.id,
            clientName: `${c.firstName} ${c.lastName}`.trim(),
            clientCode: c.clientCode,
            reason: 'Reassessment window open',
            assessmentId: latest.id,
          })
        }
      }
    } else if (!latest || status === 'DRAFT' || status === 'IN_PROGRESS') {
      actionQueue.push({
        id: `assess-${c.id}`,
        clientId: c.id,
        clientName: `${c.firstName} ${c.lastName}`.trim(),
        clientCode: c.clientCode,
        reason: latest ? 'Assessment in progress' : 'Assessment not started yet',
        assessmentId: latest?.id ?? null,
      })
    }

    return {
      id: c.id,
      clientCode: c.clientCode,
      firstName: c.firstName,
      lastName: c.lastName,
      dateOfBirth: c.dateOfBirth,
      stage: c.stage,
      assessmentStatus: status,
      assessmentId: latest?.id ?? null,
      nextReassessmentDate,
      authEndDate: authEnd,
      updatedAt: c.updatedAt,
      lifecycle,
    }
  })

  assessments.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  const fullName = user.name?.trim() || null
  const lead = user.crmRoles?.includes('CLINICAL_LEAD')
  const credentialsLine = fullName
    ? `${fullName}${lead ? ', Clinical Lead' : ', BCBA'}`
    : user.email
      ? `${user.email}`
      : null

  const clientCount = await prisma.serviceClient.count({
    where: { ...where, ...NOT_DELETED },
  })

  let inbox: BcbaPortalDashboard['inbox'] = { items: [], unreadCount: 0 }
  try {
    inbox = await listPortalInbox(user, { limit: 8 })
  } catch (err) {
    console.error('[portal] inbox load failed', err)
  }

  const caseloadCompletionPct =
    clientCount === 0
      ? 0
      : Math.round((finishedAssessments / Math.max(clientCount, 1)) * 100)

  return {
    greetingName: fullName?.split(' ')[0] || user.email || 'there',
    credentialsLine,
    clientCount,
    assessmentMix,
    readyToAssess,
    authExpiring30,
    reassessmentsDue,
    caseloadCompletionPct: Math.min(100, caseloadCompletionPct),
    actionQueue: actionQueue.slice(0, 25),
    clients: rows,
    assessments: assessments.slice(0, 80),
    inbox,
  }
}
