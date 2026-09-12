import type { CrmUser } from '@/lib/crm/access'
import { getVisibleClientsWhere } from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'
import { NOT_DELETED } from '@/lib/crm/softDelete'

export type BcbaPortalDashboard = {
  greetingName: string
  clientCount: number
  assessmentMix: { draft: number; inProgress: number; signed: number; completed: number }
  authExpiring30: number
  reassessmentsDue: number
  actionQueue: {
    id: string
    clientId: string
    clientName: string
    clientCode: string
    reason: string
  }[]
  clients: {
    id: string
    clientCode: string
    firstName: string
    lastName: string
    dateOfBirth: Date | null
    stage: string
    assessmentStatus: string | null
    authEndDate: Date | null
    updatedAt: Date
  }[]
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d)
  out.setUTCMonth(out.getUTCMonth() + months)
  return out
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
        take: 1,
        select: { id: true, status: true, updatedAt: true, signedAt: true },
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
  const actionQueue: BcbaPortalDashboard['actionQueue'] = []

  const rows: BcbaPortalDashboard['clients'] = clients.map((c) => {
    const latest = c.treatmentAssessments[0] ?? null
    const status = latest?.status ?? null
    if (!latest) {
      // no assessment yet — count as draft backlog for mix? skip
    } else if (status === 'DRAFT') assessmentMix.draft += 1
    else if (status === 'IN_PROGRESS') assessmentMix.inProgress += 1
    else if (status === 'SIGNED') assessmentMix.signed += 1
    else if (status === 'COMPLETED') assessmentMix.completed += 1

    const authEnd = c.authorizations[0]?.expirationDate ?? null
    if (authEnd && authEnd >= now && authEnd <= in30) {
      authExpiring30 += 1
      actionQueue.push({
        id: `auth-${c.id}`,
        clientId: c.id,
        clientName: `${c.firstName} ${c.lastName}`.trim(),
        clientCode: c.clientCode,
        reason: 'Authorization expires within 30 days',
      })
    }

    // 6-month reassessment cadence from last signed/completed assessment
    if (latest && (latest.status === 'SIGNED' || latest.status === 'COMPLETED')) {
      const anchor = latest.signedAt ?? latest.updatedAt
      const due = addMonths(anchor, 6)
      if (due <= in90) {
        reassessmentsDue += 1
        if (due <= now) {
          actionQueue.push({
            id: `reassess-${c.id}`,
            clientId: c.id,
            clientName: `${c.firstName} ${c.lastName}`.trim(),
            clientCode: c.clientCode,
            reason: 'Reassessment window open',
          })
        }
      }
    } else if (!latest || status === 'DRAFT' || status === 'IN_PROGRESS') {
      actionQueue.push({
        id: `assess-${c.id}`,
        clientId: c.id,
        clientName: `${c.firstName} ${c.lastName}`.trim(),
        clientCode: c.clientCode,
        reason: latest ? 'Assessment in progress' : 'Assessment not started',
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
      authEndDate: authEnd,
      updatedAt: c.updatedAt,
    }
  })

  return {
    greetingName: user.name?.split(' ')[0] || user.email || 'there',
    clientCount: await prisma.serviceClient.count({
      where: { ...where, ...NOT_DELETED },
    }),
    assessmentMix,
    authExpiring30,
    reassessmentsDue,
    actionQueue: actionQueue.slice(0, 25),
    clients: rows,
  }
}
