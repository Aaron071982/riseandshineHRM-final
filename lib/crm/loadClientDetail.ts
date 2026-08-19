import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  assertCanViewClient,
  auditClientAction,
  canEditClientRecord,
  getClientServicesUser,
  getVisibleClientsWhere,
  type CrmUser,
} from '@/lib/crm/access'
import { canAdvance, stageIndex } from '@/lib/crm/stages'
import { isMedicaidPayer } from '@/lib/crm/documents'
import { evaluateReferralValidity } from '@/lib/crm/referralValidity'
import { hoursBetween } from '@/lib/rbt-schedule/utils'
import { allowedTemplatesForUser } from '@/lib/crm/emails/templatePolicy'
import { graphEmailEnabled } from '@/lib/crm/emails/graphSend'
import { hasRiseAndShineMailbox, mailboxBlockedReason } from '@/lib/crm/emails/mailbox'

export async function loadClientCrmDetail(clientId: string) {
  const user = await getClientServicesUser()
  await assertCanViewClient(user, clientId)

  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, ...getVisibleClientsWhere(user) },
    include: {
      requirements: {
        where: { deletedAt: null },
        orderBy: [{ stage: 'asc' }, { key: 'asc' }],
        include: {
          attestedByUser: { select: { id: true, name: true, email: true } },
        },
      },
      consent: true,
      referralCheck: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          changedByUser: { select: { id: true, name: true, email: true } },
        },
      },
      clientNotes: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      bcbaProfile: { select: { id: true, fullName: true, email: true } },
      caseCoordinatorUser: { select: { id: true, name: true, email: true } },
      currentOwnerUser: { select: { id: true, name: true, email: true } },
      accessLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      authorizations: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { lines: { where: { deletedAt: null }, orderBy: { cptCode: 'asc' } } },
      },
      btAssignments: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        include: {
          rbtProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              status: true,
            },
          },
        },
      },
      scheduleAssignments: {
        where: {
          isActive: true,
          deletedAt: null,
          reviewStatus: { in: ['NONE', 'CONFIRMED'] },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          rbtProfile: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      communications: {
        where: { deletedAt: null },
        orderBy: { sentAt: 'desc' },
        take: 100,
        include: {
          sentByUser: { select: { id: true, name: true, email: true } },
        },
      },
      rbtBreaks: {
        where: { status: 'ON_BREAK' },
        orderBy: { createdAt: 'desc' },
      },
      alerts: {
        where: { resolvedAt: null, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!client) notFound()

  await auditClientAction({
    userId: user.id,
    serviceClientId: client.id,
    action: 'VIEW',
  })

  const consentLive =
    client.consent && !client.consent.deletedAt ? client.consent : null
  const referralLive =
    client.referralCheck && !client.referralCheck.deletedAt
      ? client.referralCheck
      : null
  const referralEval = evaluateReferralValidity(referralLive)
  const gate = canAdvance(
    {
      stage: client.stage,
      treatmentPlanStatus: client.treatmentPlanStatus,
      consentBillingReady: consentLive?.billingReady ?? false,
      referralValid: referralEval.ok,
      requiresMedicaidReferral: isMedicaidPayer(client.insuranceProvider),
    },
    client.requirements
  )
  const daysInStage = daysSince(client.stageEnteredAt)
  const weeklyScheduleHours = client.scheduleAssignments.reduce(
    (sum, s) => sum + hoursBetween(s.startTime, s.endTime),
    0
  )

  const claimed =
    user.fullAccess ||
    client.currentOwnerUserId === user.id ||
    client.caseCoordinatorUserId === user.id
  const canEdit = canEditClientRecord(user, {
    caseCoordinatorUserId: client.caseCoordinatorUserId,
    currentOwnerDept: client.currentOwnerDept,
    hasClaimGrant: true,
  })
  const mailboxReason = mailboxBlockedReason(user.email)
  const canSendEmail = claimed && !mailboxReason && !!client.parentEmail?.trim()

  return {
    user,
    client,
    gate,
    daysInStage,
    weeklyScheduleHours,
    canEdit,
    canOverrideStage: user.fullAccess,
    stageNumber: stageIndex(client.stage) + 1,
    emailSend: {
      allowedTemplates: allowedTemplatesForUser(user),
      canSend: canSendEmail,
      blockedReason: !claimed
        ? 'Claim this client or be assigned as case coordinator to send email.'
        : mailboxReason ?? (!client.parentEmail?.trim()
            ? 'No parent email on file for this client.'
            : null),
      graphEnabled: graphEmailEnabled(),
      hasMailbox: hasRiseAndShineMailbox(user.email),
    },
  }
}

export function daysSince(from: Date | null | undefined): number | null {
  if (!from) return null
  const ms = Date.now() - from.getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

export type ClientCrmDetailData = Awaited<ReturnType<typeof loadClientCrmDetail>>
export type ClientCrmUser = CrmUser
