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
import { stageIndex } from '@/lib/crm/stages'
import { hoursBetween } from '@/lib/rbt-schedule/utils'
import { allowedTemplatesForUser } from '@/lib/crm/emails/templatePolicy'
import { graphEmailEnabled } from '@/lib/crm/emails/graphSend'
import { hasRiseAndShineMailbox, mailboxBlockedReason } from '@/lib/crm/emails/mailbox'
import { ensureClientRequirements } from '@/lib/crm/ensureRequirements'
import { ensureCanonicalOwnerDept } from '@/lib/crm/ensureOwnerDept'
import { loadCrmTaskAssigneeUsers } from '@/lib/crm/tasks/assignees'
import {
  isConsentLineInitialed,
  parseConsentLines,
} from '@/lib/crm/consent'
import { teamTaskVisibilityWhere } from '@/lib/crm/tasks/access'
import {
  canAccessBillingSurface,
  canViewBillingDocuments,
} from '@/lib/crm/billingAccess'
import {
  canEditTreatmentAssessment,
  canUploadTreatmentAssessmentFiles,
  canViewTreatmentAssessment,
} from '@/lib/crm/assessment/access'
import {
  auditTreatmentAssessmentView,
} from '@/lib/crm/assessment/actions'
import {
  hasCompletedTreatmentAssessment,
  listTreatmentAssessments,
} from '@/lib/crm/assessment/load'
import { canViewCaseCoordination } from '@/lib/crm/caseCoordination/access'
import { loadCaseCoordinationPanelData } from '@/lib/crm/caseCoordination/actions'

export async function loadClientCrmDetail(clientId: string) {
  const user = await getClientServicesUser()
  await assertCanViewClient(user, clientId)
  await ensureClientRequirements(clientId)

  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, ...getVisibleClientsWhere(user) },
    include: {
      requirements: {
        where: { deletedAt: null },
        orderBy: [{ stage: 'asc' }, { key: 'asc' }],
        include: {
          attestedByUser: { select: { id: true, name: true, email: true } },
          completedByUser: { select: { id: true, name: true, email: true } },
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
        include: {
          lines: { where: { deletedAt: null }, orderBy: { cptCode: 'asc' } },
          sentToInsuranceByUser: {
            select: { id: true, name: true, email: true },
          },
        },
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

  client.currentOwnerDept = await ensureCanonicalOwnerDept(
    client.id,
    client.stage,
    client.currentOwnerDept
  )

  await auditClientAction({
    userId: user.id,
    serviceClientId: client.id,
    action: 'VIEW',
  })

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
  const consentLive =
    client.consent && !client.consent.deletedAt ? client.consent : null
  const emailConsentOk =
    !!consentLive &&
    isConsentLineInitialed(parseConsentLines(consentLive.lines), 'comm_email')

  const [teamTasks, taskUsers, billingNotes, authorizationTemplate] = await Promise.all([
    prisma.teamTask.findMany({
      where: {
        AND: [
          teamTaskVisibilityWhere(user),
          { serviceClientId: clientId },
        ],
      },
      orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }],
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        serviceClient: {
          select: { id: true, firstName: true, lastName: true, clientCode: true },
        },
        subtasks: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { comments: true } },
      },
    }),
    loadCrmTaskAssigneeUsers(),
    canAccessBillingSurface(user)
      ? prisma.clientBillingNote.findMany({
          where: { serviceClientId: clientId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    canAccessBillingSurface(user)
      ? prisma.clientAuthorizationTemplate.findFirst({
          where: { serviceClientId: clientId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedByUser: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve(null),
  ])

  const treatmentAssessmentVisible = canViewTreatmentAssessment(user)
  let treatmentAssessments: Awaited<ReturnType<typeof listTreatmentAssessments>> = []
  let hasAssessmentOnFile = false

  if (treatmentAssessmentVisible) {
    await auditTreatmentAssessmentView(clientId)
    treatmentAssessments = await listTreatmentAssessments(clientId)
    hasAssessmentOnFile = await hasCompletedTreatmentAssessment(clientId)
  }

  const caseCoordinationVisible = canViewCaseCoordination(user)
  const caseCoordination = caseCoordinationVisible
    ? await loadCaseCoordinationPanelData(clientId)
    : null

  return {
    user,
    client,
    teamTasks,
    taskUsers,
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
      emailConsentOk,
    },
    billing: {
      canAccess: canAccessBillingSurface(user),
      canEdit: canEdit && canAccessBillingSurface(user),
      documentsAvailable: canViewBillingDocuments(client.stage),
      notes: billingNotes,
      authorizationTemplate,
    },
    treatmentAssessment: treatmentAssessmentVisible
      ? {
          canView: true,
          canEdit: canEditTreatmentAssessment(user),
          canUpload: canUploadTreatmentAssessmentFiles(user),
          hasAssessmentOnFile,
          assessments: treatmentAssessments,
        }
      : { canView: false },
    caseCoordination: caseCoordinationVisible
      ? {
          canView: true,
          canEdit: caseCoordination?.canEdit ?? false,
          canConfirm: caseCoordination?.canConfirm ?? false,
          record: caseCoordination?.record ?? null,
          document: caseCoordination?.document ?? null,
        }
      : { canView: false },
  }
}

export function daysSince(from: Date | null | undefined): number | null {
  if (!from) return null
  const ms = Date.now() - from.getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

export type ClientCrmDetailData = Awaited<ReturnType<typeof loadClientCrmDetail>>
export type ClientCrmUser = CrmUser
