import type {
  AlertSeverity,
  ClientAlertType,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getClientServicesFullAccessEmails } from '@/lib/client-services/constants'
import { makePublicUrl } from '@/lib/baseUrl'
import {
  authBandForDaysLeft,
  authSeverityForBand,
  stalledSeverity,
} from '@/lib/crm/alertRules'
import {
  DOCS_MISSING_DAYS,
  RBT_REPLACEMENT_ESCALATE_DAYS,
  SERVICE_GAP_GRACE_DAYS,
  STAGE_MAX_DAYS,
  daysInStage,
  isStalled,
  inquiryUncontactedBefore,
} from '@/lib/crm/thresholds'
import { retryFailedJourneyEmails } from '@/lib/crm/emails/send'

export type AlertScanStats = {
  created: number
  updated: number
  unchanged: number
  resolved: number
  urgentNotified: number
  emailRetries: { attempted: number; sent: number; failed: number; skipped: number }
}

type DesiredAlert = {
  alertType: ClientAlertType
  severity: AlertSeverity
  message: string
  dueAt: Date | null
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

async function fullAccessUserIds(): Promise<string[]> {
  const emails = getClientServicesFullAccessEmails()
  if (emails.length === 0) return []
  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: 'insensitive' } },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

async function notifyUrgent(params: {
  clientId: string
  clientCode: string
  clientName: string
  alertType: ClientAlertType
  message: string
}): Promise<number> {
  const userIds = await fullAccessUserIds()
  if (userIds.length === 0) return 0

  const linkUrl = makePublicUrl(`/client-services/clients/${params.clientId}`)
  const type = `CRM_ALERT_${params.alertType}`
  const message = `[${params.clientCode}] ${params.clientName}: ${params.message}`

  // Avoid flooding: skip if same unread notification already exists for this link+type
  const existing = await prisma.adminNotification.findMany({
    where: {
      userId: { in: userIds },
      type,
      linkUrl,
      isRead: false,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { userId: true },
  })
  const already = new Set(existing.map((e) => e.userId))
  const targets = userIds.filter((id) => !already.has(id))
  if (targets.length === 0) return 0

  await prisma.adminNotification.createMany({
    data: targets.map((userId) => ({
      userId,
      type,
      message,
      linkUrl,
    })),
  })
  return targets.length
}

async function upsertClientAlert(
  serviceClientId: string,
  desired: DesiredAlert,
  meta: { clientCode: string; clientName: string }
): Promise<'created' | 'updated' | 'unchanged'> {
  const existing = await prisma.clientAlert.findFirst({
    where: {
      serviceClientId,
      alertType: desired.alertType,
      resolvedAt: null,
    },
  })

  if (existing) {
    const same =
      existing.severity === desired.severity &&
      existing.message === desired.message &&
      ((existing.dueAt == null && desired.dueAt == null) ||
        (existing.dueAt != null &&
          desired.dueAt != null &&
          existing.dueAt.getTime() === desired.dueAt.getTime()))

    if (same) return 'unchanged'

    await prisma.clientAlert.update({
      where: { id: existing.id },
      data: {
        severity: desired.severity,
        message: desired.message,
        dueAt: desired.dueAt,
      },
    })

    return 'updated'
  }

  await prisma.clientAlert.create({
    data: {
      serviceClientId,
      alertType: desired.alertType,
      severity: desired.severity,
      message: desired.message,
      dueAt: desired.dueAt,
    },
  })
  return 'created'
}

async function resolveAlertType(
  serviceClientId: string,
  alertType: ClientAlertType,
  now: Date
): Promise<boolean> {
  const result = await prisma.clientAlert.updateMany({
    where: { serviceClientId, alertType, resolvedAt: null },
    data: { resolvedAt: now },
  })
  return result.count > 0
}

const ALERT_TYPES: ClientAlertType[] = [
  'AUTH_EXPIRING',
  'UNCONTACTED_INQUIRY',
  'STAGE_STALLED',
  'DOCS_MISSING',
  'DOC_EXPIRING',
  'RBT_REPLACEMENT_NEEDED',
  'SERVICE_GAP',
]

type ScanClient = Prisma.ServiceClientGetPayload<{
  select: {
    id: true
    clientCode: true
    firstName: true
    lastName: true
    stage: true
    pipelineStatus: true
    stageEnteredAt: true
    lastParentContactAt: true
    rbtTargetDate: true
    authorizations: {
      select: {
        authType: true
        status: true
        expirationDate: true
        payerName: true
      }
    }
    requirements: {
      select: {
        id: true
        type: true
        status: true
        createdAt: true
        label: true
        key: true
        expiresAt: true
      }
    }
    alerts: {
      select: {
        id: true
        alertType: true
        severity: true
        message: true
        createdAt: true
        dueAt: true
        resolvedAt: true
      }
    }
    btAssignments: {
      select: { status: true; rbtProfileId: true; createdAt: true }
    }
    serviceBreaks: {
      select: { status: true; expectedReturnDate: true; reason: true }
    }
    rbtBreaks: {
      select: {
        status: true
        expectedReturnDate: true
        hasCoverage: true
        btName: true
      }
    }
  }
}>

function evaluateClient(client: ScanClient, now: Date): DesiredAlert[] {
  const desired: DesiredAlert[] = []
  const name = `${client.firstName} ${client.lastName}`.trim()
  const live = client.pipelineStatus === 'LIVE'

  // AUTH_EXPIRING — active treatment auths within 60d (soonest expiry wins)
  if (live && client.stage === 'ACTIVE') {
    let best: DesiredAlert | null = null
    for (const a of client.authorizations) {
      if (
        a.authType !== 'TREATMENT' ||
        a.status !== 'APPROVED' ||
        !a.expirationDate
      ) {
        continue
      }
      const exp = a.expirationDate
      const daysLeft = Math.ceil(
        (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )
      const band = authBandForDaysLeft(daysLeft)
      if (!band) continue
      const candidate: DesiredAlert = {
        alertType: 'AUTH_EXPIRING',
        severity: authSeverityForBand(band),
        message: `Treatment auth (${a.payerName}) expires in ${daysLeft}d (≤${band}d band)`,
        dueAt: exp,
      }
      if (!best || (best.dueAt && exp < best.dueAt)) {
        best = candidate
      }
    }
    if (best) desired.push(best)
  }

  // UNCONTACTED_INQUIRY
  if (live && client.stage === 'INQUIRY') {
    const cutoff = inquiryUncontactedBefore(now)
    const uncontacted =
      !client.lastParentContactAt || client.lastParentContactAt < cutoff
    if (uncontacted) {
      desired.push({
        alertType: 'UNCONTACTED_INQUIRY',
        severity: 'WARNING',
        message: `Inquiry for ${name} has no parent contact past 1 business day`,
        dueAt: cutoff,
      })
    }
  }

  // STAGE_STALLED (stage max days and/or missed rbtTargetDate while staffing)
  if (live && isStalled(client, now)) {
    const days = daysInStage(client)
    const max = STAGE_MAX_DAYS[client.stage]
    const missedTarget =
      !!client.rbtTargetDate &&
      new Date(client.rbtTargetDate).getTime() < now.getTime() &&
      days <= max
    desired.push({
      alertType: 'STAGE_STALLED',
      severity: stalledSeverity(days, max),
      message: missedTarget
        ? `${name} past RBT target date (${new Date(client.rbtTargetDate!).toLocaleDateString()}) while in ${client.stage.replace(/_/g, ' ')}`
        : `${name} stalled in ${client.stage.replace(/_/g, ' ')} for ${days}d (max ${max}d)`,
      dueAt: client.rbtTargetDate ?? null,
    })
  }

  // DOCS_MISSING — open DOCUMENT requirements past threshold
  if (live) {
    const openDocs = client.requirements.filter(
      (r) =>
        r.type === 'DOCUMENT' &&
        (r.status === 'PENDING' ||
          r.status === 'MISSING' ||
          r.status === 'EXPIRED')
    )
    const thresholdMs = DOCS_MISSING_DAYS * 24 * 60 * 60 * 1000
    const overdue = openDocs.filter(
      (r) => now.getTime() - r.createdAt.getTime() >= thresholdMs
    )
    if (overdue.length > 0) {
      const oldest = overdue.reduce((a, b) =>
        a.createdAt < b.createdAt ? a : b
      )
      desired.push({
        alertType: 'DOCS_MISSING',
        severity: 'WARNING',
        message: `${overdue.length} document requirement(s) open >${DOCS_MISSING_DAYS}d (e.g. ${oldest.label})`,
        dueAt: new Date(oldest.createdAt.getTime() + thresholdMs),
      })
    }
  }

  // DOC_EXPIRING — clinical eval / referral / consent within auth-style bands
  if (live) {
    let best: DesiredAlert | null = null
    for (const r of client.requirements) {
      if (r.type !== 'DOCUMENT' || !r.expiresAt) continue
      if (
        r.status !== 'RECEIVED' &&
        r.status !== 'ON_FILE' &&
        r.status !== 'COMPLETE' &&
        r.status !== 'EXPIRED'
      ) {
        continue
      }
      const daysLeft = Math.ceil(
        (r.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )
      const band = authBandForDaysLeft(daysLeft)
      if (!band) continue
      const candidate: DesiredAlert = {
        alertType: 'DOC_EXPIRING',
        severity: authSeverityForBand(band),
        message:
          daysLeft < 0
            ? `${r.label} expired ${Math.abs(daysLeft)}d ago`
            : `${r.label} expires in ${daysLeft}d (≤${band}d band)`,
        dueAt: r.expiresAt,
      }
      if (!best || (best.dueAt && r.expiresAt < best.dueAt)) {
        best = candidate
      }
    }
    if (best) desired.push(best)
  }

  // RBT_REPLACEMENT_NEEDED — uncovered RBT break, or flagged with no active RBT
  const openUncoveredBreaks = client.rbtBreaks.filter(
    (b) => b.status === 'ON_BREAK' && !b.hasCoverage
  )
  const existingReplacement = client.alerts.find(
    (a) => a.alertType === 'RBT_REPLACEMENT_NEEDED' && !a.resolvedAt
  )
  const hasActiveRbt = client.btAssignments.some((a) => !!a.rbtProfileId)
  const needsReplacement =
    openUncoveredBreaks.length > 0 ||
    (!!existingReplacement && !hasActiveRbt)

  if (needsReplacement) {
    const createdAt = existingReplacement?.createdAt ?? now
    const ageDays = Math.floor(
      (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
    )
    const escalate = ageDays >= RBT_REPLACEMENT_ESCALATE_DAYS
    const bt =
      openUncoveredBreaks[0]?.btName ||
      existingReplacement?.message ||
      'RBT'
    desired.push({
      alertType: 'RBT_REPLACEMENT_NEEDED',
      severity: escalate ? 'URGENT' : existingReplacement?.severity === 'URGENT' ? 'URGENT' : 'WARNING',
      message: escalate
        ? `RBT replacement still open after ${ageDays}d — ${bt}`
        : existingReplacement?.message ||
          `RBT replacement needed — ${bt}`,
      dueAt:
        openUncoveredBreaks[0]?.expectedReturnDate ??
        existingReplacement?.dueAt ??
        null,
    })
  }

  // SERVICE_GAP — ON_HOLD or breaks past expected return
  const gapCutoff = startOfDay(now)
  gapCutoff.setDate(gapCutoff.getDate() - SERVICE_GAP_GRACE_DAYS)

  if (client.pipelineStatus === 'ON_HOLD') {
    desired.push({
      alertType: 'SERVICE_GAP',
      severity: 'WARNING',
      message: `${name} pipeline is on hold`,
      dueAt: null,
    })
  } else {
    const overdueClientBreaks = client.serviceBreaks.filter(
      (b) => b.status === 'ON_BREAK' && b.expectedReturnDate < gapCutoff
    )
    const overdueRbtBreaks = client.rbtBreaks.filter(
      (b) => b.status === 'ON_BREAK' && b.expectedReturnDate < gapCutoff
    )
    if (overdueClientBreaks.length > 0 || overdueRbtBreaks.length > 0) {
      const detail =
        overdueClientBreaks[0]?.reason ||
        (overdueRbtBreaks[0]
          ? `RBT ${overdueRbtBreaks[0].btName} break past return`
          : 'service break past return')
      desired.push({
        alertType: 'SERVICE_GAP',
        severity: 'WARNING',
        message: `Service gap: ${detail}`,
        dueAt:
          overdueClientBreaks[0]?.expectedReturnDate ??
          overdueRbtBreaks[0]?.expectedReturnDate ??
          null,
      })
    }
  }

  return desired
}

/**
 * System-actor alert scan. Idempotent: upserts unresolved alerts by
 * (serviceClientId, alertType); resolves when the condition clears.
 */
export async function runAlertScan(now = new Date()): Promise<AlertScanStats> {
  const stats: AlertScanStats = {
    created: 0,
    updated: 0,
    unchanged: 0,
    resolved: 0,
    urgentNotified: 0,
    emailRetries: { attempted: 0, sent: 0, failed: 0, skipped: 0 },
  }

  const pageSize = 100
  let cursor: string | undefined

  for (;;) {
    const clients = await prisma.serviceClient.findMany({
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      where: { deletedAt: null },
      select: {
        id: true,
        clientCode: true,
        firstName: true,
        lastName: true,
        stage: true,
        pipelineStatus: true,
        stageEnteredAt: true,
        lastParentContactAt: true,
        rbtTargetDate: true,
        authorizations: {
          where: {
            deletedAt: null,
            authType: 'TREATMENT',
            status: 'APPROVED',
            expirationDate: { not: null },
          },
          select: {
            authType: true,
            status: true,
            expirationDate: true,
            payerName: true,
          },
        },
        requirements: {
          where: {
            deletedAt: null,
            type: 'DOCUMENT',
          },
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            label: true,
            key: true,
            expiresAt: true,
          },
        },
        alerts: {
          where: { resolvedAt: null },
          select: {
            id: true,
            alertType: true,
            severity: true,
            message: true,
            createdAt: true,
            dueAt: true,
            resolvedAt: true,
          },
        },
        btAssignments: {
          where: { status: 'ACTIVE' },
          select: { status: true, rbtProfileId: true, createdAt: true },
        },
        serviceBreaks: {
          where: { status: 'ON_BREAK' },
          select: { status: true, expectedReturnDate: true, reason: true },
        },
        rbtBreaks: {
          where: { status: 'ON_BREAK' },
          select: {
            status: true,
            expectedReturnDate: true,
            hasCoverage: true,
            btName: true,
          },
        },
      },
    })

    if (clients.length === 0) break

    for (const client of clients) {
      for (const r of client.requirements) {
        if (
          r.expiresAt &&
          r.expiresAt.getTime() < now.getTime() &&
          (r.status === 'RECEIVED' ||
            r.status === 'ON_FILE' ||
            r.status === 'COMPLETE')
        ) {
          await prisma.clientRequirement.update({
            where: { id: r.id },
            data: { status: 'EXPIRED' },
          })
          r.status = 'EXPIRED'
        }
      }

      const clientName = `${client.firstName} ${client.lastName}`.trim()
      const desired = evaluateClient(client, now)
      const desiredTypes = new Set(desired.map((d) => d.alertType))

      for (const d of desired) {
        const result = await upsertClientAlert(client.id, d, {
          clientCode: client.clientCode,
          clientName,
        })
        if (result === 'created') stats.created++
        else if (result === 'updated') stats.updated++
        else stats.unchanged++

        if (
          d.severity === 'URGENT' &&
          (result === 'created' || result === 'updated')
        ) {
          const prior = client.alerts.find((a) => a.alertType === d.alertType)
          const newlyUrgent =
            result === 'created' || prior?.severity !== 'URGENT'
          if (newlyUrgent) {
            stats.urgentNotified += await notifyUrgent({
              clientId: client.id,
              clientCode: client.clientCode,
              clientName,
              alertType: d.alertType,
              message: d.message,
            })
          }
        }
      }

      for (const type of ALERT_TYPES) {
        if (desiredTypes.has(type)) continue
        if (await resolveAlertType(client.id, type, now)) {
          stats.resolved++
        }
      }
    }

    cursor = clients[clients.length - 1]?.id
    if (clients.length < pageSize) break
  }

  // Light retry of FAILED/PENDING journey emails (Part B safety rails apply)
  stats.emailRetries = await retryFailedJourneyEmails()

  return stats
}
