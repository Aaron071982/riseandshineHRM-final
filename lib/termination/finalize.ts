import {
  OffboardingTaskType,
  RBTStatus,
  TerminationReason,
  TerminationStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail, sendGenericEmail, generateRejectionEmail, EmailTemplateType } from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'
import { getWorkflowSettings } from '@/lib/workflow-settings'
import { removeActiveStatusManual } from '@/lib/rbt/activeWorking'
import { generateAllTerminationDocuments } from './documents'
import { seedOffboardingTaskTypes, allTasksComplete } from './tasks'
import { DEFAULT_EHR_SYSTEM } from './constants'

export type FinalizeTerminationInput = {
  rbtProfileId: string
  decisionMakerId: string
  actorLabel: string
  reason: TerminationReason
  reasonNarrative: string
  terminationDate: Date
  lastDayWorked: Date
  benefitsEndDate: Date
  finalPayDate: Date
  noticeDeadline: Date
  counselConsulted: boolean
  reasonDocumented: boolean
  consistencyChecked: boolean
  redFlagPresent: boolean
  contractChecked: boolean
  regularWages?: string
  overtimeOwed?: string
  commissionsOwed?: string
  ptoPayout?: string
  deductions?: string
  netFinalPay?: string
  otherBenefitName?: string
  otherBenefitEndDate?: Date | null
  ehrSystemName?: string
  propertyList?: string
  coveragePlan?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const AUTO_COMPLETE_TASKS: OffboardingTaskType[] = [
  OffboardingTaskType.DISABLE_HRM_ACCESS,
  OffboardingTaskType.REMOVE_FROM_ROSTER,
  OffboardingTaskType.REASSIGN_CLIENTS,
]

export async function finalizeTermination(input: FinalizeTerminationInput) {
  const profile = await prisma.rBTProfile.findUnique({
    where: { id: input.rbtProfileId },
    include: { user: true, termination: true },
  })
  if (!profile) throw new Error('RBT profile not found')
  if (profile.termination) throw new Error('Termination record already exists for this employee')
  if (!['HIRED', 'ONBOARDING_COMPLETED'].includes(profile.status)) {
    throw new Error('Only hired or onboarding-completed RBTs can be terminated')
  }
  if (input.redFlagPresent && !input.counselConsulted) {
    throw new Error('Consult employment counsel before finalizing when red-flag timing applies')
  }
  if (!input.reasonDocumented || !input.consistencyChecked || !input.contractChecked) {
    throw new Error('Complete the compliance checklist before finalizing')
  }

  const decisionMaker = await prisma.user.findUnique({
    where: { id: input.decisionMakerId },
    select: { id: true, name: true, email: true },
  })
  if (!decisionMaker) throw new Error('Decision-maker not found')

  const assignmentCount = await prisma.clientAssignment.count({
    where: { rbtProfileId: input.rbtProfileId },
  })

  const result = await prisma.$transaction(async (tx) => {
    const termination = await tx.termination.create({
      data: {
        rbtProfileId: input.rbtProfileId,
        status: TerminationStatus.PENDING_TASKS,
        reason: input.reason,
        reasonNarrative: input.reasonNarrative,
        decisionMakerId: input.decisionMakerId,
        terminationDate: input.terminationDate,
        lastDayWorked: input.lastDayWorked,
        benefitsEndDate: input.benefitsEndDate,
        finalPayDate: input.finalPayDate,
        noticeDeadline: input.noticeDeadline,
        counselConsulted: input.counselConsulted,
        reasonDocumented: input.reasonDocumented,
        consistencyChecked: input.consistencyChecked,
        redFlagPresent: input.redFlagPresent,
        contractChecked: input.contractChecked,
        regularWages: input.regularWages,
        overtimeOwed: input.overtimeOwed,
        commissionsOwed: input.commissionsOwed,
        ptoPayout: input.ptoPayout,
        deductions: input.deductions,
        netFinalPay: input.netFinalPay,
        otherBenefitName: input.otherBenefitName,
        otherBenefitEndDate: input.otherBenefitEndDate ?? undefined,
        ehrSystemName: input.ehrSystemName || DEFAULT_EHR_SYSTEM,
        propertyList: input.propertyList,
        coveragePlan: input.coveragePlan,
      },
    })

    const taskTypes = seedOffboardingTaskTypes()
    await tx.offboardingTask.createMany({
      data: taskTypes.map((type) => ({
        terminationId: termination.id,
        type,
        completed: AUTO_COMPLETE_TASKS.includes(type),
        completedAt: AUTO_COMPLETE_TASKS.includes(type) ? new Date() : undefined,
        completedById: AUTO_COMPLETE_TASKS.includes(type) ? input.decisionMakerId : undefined,
        notes: AUTO_COMPLETE_TASKS.includes(type) ? 'Auto-completed on termination finalize' : undefined,
      })),
    })

    const docs = generateAllTerminationDocuments(profile, termination, decisionMaker)
    await tx.terminationDocument.createMany({
      data: docs.map((d) => ({
        terminationId: termination.id,
        docType: d.docType,
        storagePath: d.storagePath,
        contentHtml: d.contentHtml,
        fileName: d.fileName,
      })),
    })

    await tx.clientAssignment.deleteMany({ where: { rbtProfileId: input.rbtProfileId } })

    const terminatedAt = new Date()
    await tx.rBTProfile.update({
      where: { id: input.rbtProfileId },
      data: {
        status: RBTStatus.FIRED,
        postHireStage: 'MATCHING',
        activeWorkingSince: null,
        activeWorkingManualOverride: true,
        terminationReason: input.reasonNarrative,
        terminatedAt,
        terminatedBy: input.actorLabel,
      },
    })

    if (profile.user) {
      await tx.user.update({
        where: { id: profile.userId },
        data: { role: 'CANDIDATE', isActive: false },
      })
    }

    await tx.rBTAuditLog.create({
      data: {
        rbtProfileId: input.rbtProfileId,
        auditType: 'STATUS_CHANGE',
        dateTime: terminatedAt,
        notes: `RBT terminated (${input.reason}). Status → FIRED. Reason: ${input.reasonNarrative}. §195(6) notice deadline: ${input.noticeDeadline.toISOString().slice(0, 10)}.`,
        createdBy: input.actorLabel,
      },
    })

    await tx.rBTAuditLog.create({
      data: {
        rbtProfileId: input.rbtProfileId,
        auditType: 'NOTE',
        dateTime: terminatedAt,
        notes: `Offboarding initiated. ${assignmentCount} client assignment(s) removed. Termination packet generated.`,
        createdBy: input.actorLabel,
      },
    })

    await tx.activityLog.create({
      data: {
        userId: input.decisionMakerId,
        activityType: 'FORM_SUBMISSION',
        action: `Terminated RBT: ${profile.firstName} ${profile.lastName}`,
        resourceType: 'Termination',
        resourceId: termination.id,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
        metadata: {
          rbtProfileId: input.rbtProfileId,
          reason: input.reason,
          terminationDate: input.terminationDate.toISOString(),
          noticeDeadline: input.noticeDeadline.toISOString(),
        },
      },
    })

    return { termination, docs }
  })

  if (profile.postHireStage === 'ACTIVE_DELIVERY') {
    await removeActiveStatusManual(
      input.rbtProfileId,
      input.actorLabel,
      `Terminated: ${input.reasonNarrative}`
    ).catch(() => undefined)
  }

  try {
    const workflow = await getWorkflowSettings()
    if (workflow.emailRejection && profile.email) {
      const emailContent = generateRejectionEmail(profile)
      await sendEmail({
        to: profile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        templateType: EmailTemplateType.REJECTION,
        rbtProfileId: profile.id,
      })
    }
  } catch (emailErr) {
    console.error('[termination] rejection email failed:', emailErr)
  }

  const profileUrl = makePublicUrl(`/admin/rbts/${profile.id}`)
  const rbtName = `${profile.firstName} ${profile.lastName}`
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, email: true },
  })
  const adminHtml = `
    <p><strong>${rbtName}</strong> has been terminated effective ${input.terminationDate.toLocaleDateString('en-US')}.</p>
    <p>§195(6) notice deadline: <strong>${input.noticeDeadline.toLocaleDateString('en-US')}</strong></p>
    <p>Final pay date: ${input.finalPayDate.toLocaleDateString('en-US')}</p>
    <p>Offboarding tasks are open in the HRM.</p>
    <p><a href="${profileUrl}" style="color:#E4893D">View profile &amp; offboarding checklist</a></p>
  `
  for (const admin of admins) {
    if (admin.email) {
      sendGenericEmail(admin.email, `RBT terminated: ${rbtName}`, `<div style="font-family:sans-serif">${adminHtml}</div>`).catch(
        () => undefined
      )
    }
    await prisma.adminNotification
      .create({
        data: {
          userId: admin.id,
          type: 'RBT_TERMINATED',
          message: `Terminated: ${rbtName} — §195(6) due ${input.noticeDeadline.toLocaleDateString('en-US')}`,
          linkUrl: profileUrl,
        },
      })
      .catch(() => undefined)
  }

  return result
}

export async function completeOffboardingTask(
  taskId: string,
  completedById: string,
  notes?: string
) {
  const task = await prisma.offboardingTask.update({
    where: { id: taskId },
    data: {
      completed: true,
      completedAt: new Date(),
      completedById,
      notes: notes?.trim() || undefined,
    },
    include: { termination: true },
  })

  if (task.type === OffboardingTaskType.ISSUE_195_6_NOTICE) {
    await prisma.termination.update({
      where: { id: task.terminationId },
      data: { noticeIssuedAt: new Date() },
    })
  }

  const allTasks = await prisma.offboardingTask.findMany({
    where: { terminationId: task.terminationId },
  })
  if (allTasksComplete(allTasks)) {
    await prisma.termination.update({
      where: { id: task.terminationId },
      data: { status: TerminationStatus.COMPLETED },
    })
  }

  return task
}
