import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { getWorkflowSettings } from '@/lib/workflow-settings'
import {
  sendEmail,
  generateApplicationReviewedEmail,
  generateReachOutEmail,
  generateRejectionEmail,
  EmailTemplateType,
} from '@/lib/email'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const { status } = await request.json()

    const previous = await prisma.rBTProfile.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!previous) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    // Use transaction to ensure both updates happen atomically
    const result = await prisma.$transaction(async (tx) => {
      if (status === 'INTERVIEW_COMPLETED') {
        await tx.interview.updateMany({
          where: { rbtProfileId: id, status: 'SCHEDULED' },
          data: { status: 'COMPLETED' },
        })
      }

      const rbtProfile = await tx.rBTProfile.update({
        where: { id },
        data: { status },
      })

      await tx.rBTAuditLog.create({
        data: {
          rbtProfileId: id,
          auditType: 'STATUS_CHANGE',
          dateTime: new Date(),
          notes: `Status changed from ${previous.status} to ${status}`,
          createdBy: user?.email || user?.name || 'Admin',
        },
      })

      return rbtProfile
    })

    // Workflow triggers (after transaction, non-blocking best-effort)
    const workflow = await getWorkflowSettings()

    if (previous.status === 'NEW' && status === 'REACH_OUT' && workflow.emailReachOut) {
      const profile = await prisma.rBTProfile.findUnique({ where: { id }, select: { firstName: true, email: true } })
      if (profile?.email) {
        const emailContent = generateApplicationReviewedEmail(profile.firstName)
        await sendEmail({
          to: profile.email,
          subject: emailContent.subject,
          html: emailContent.html,
          templateType: EmailTemplateType.APPLICATION_REVIEWED,
          rbtProfileId: id,
        }).catch((e) => console.error('Workflow NEW→REACH_OUT email failed:', e))
        await prisma.rBTAuditLog.create({
          data: {
            rbtProfileId: id,
            auditType: 'NOTE',
            dateTime: new Date(),
            notes: 'Workflow: application reviewed email sent',
            createdBy: 'System',
          },
        }).catch(() => {})
      }
    }

    if (previous.status === 'REACH_OUT' && status === 'TO_INTERVIEW' && workflow.emailToInterview) {
      let profile = await prisma.rBTProfile.findUnique({
        where: { id },
        select: { id: true, firstName: true, lastName: true, email: true, schedulingToken: true },
      })
      if (profile?.email) {
        let token = profile.schedulingToken
        if (!token) {
          token = randomBytes(32).toString('hex')
          await prisma.rBTProfile.update({ where: { id }, data: { schedulingToken: token } })
        }
        const emailContent = generateReachOutEmail(
          { id: profile.id, firstName: profile.firstName, lastName: profile.lastName, email: profile.email },
          token
        )
        await sendEmail({
          to: profile.email,
          subject: emailContent.subject,
          html: emailContent.html,
          templateType: EmailTemplateType.REACH_OUT,
          rbtProfileId: id,
        }).catch((e) => console.error('Workflow REACH_OUT→TO_INTERVIEW email failed:', e))
        await prisma.rBTAuditLog.create({
          data: {
            rbtProfileId: id,
            auditType: 'NOTE',
            dateTime: new Date(),
            notes: 'Workflow: interview scheduling email sent',
            createdBy: 'System',
          },
        }).catch(() => {})
      }
    }

    if (previous.status === 'INTERVIEW_COMPLETED' && status === 'REJECTED' && workflow.emailRejection) {
      const profile = await prisma.rBTProfile.findUnique({
        where: { id },
        select: { firstName: true, lastName: true, email: true },
      })
      if (profile?.email) {
        const emailContent = generateRejectionEmail(profile)
        await sendEmail({
          to: profile.email,
          subject: emailContent.subject,
          html: emailContent.html,
          templateType: EmailTemplateType.REJECTION,
          rbtProfileId: id,
        }).catch((e) => console.error('Workflow INTERVIEW_COMPLETED→REJECTED email failed:', e))
        await prisma.rBTAuditLog.create({
          data: {
            rbtProfileId: id,
            auditType: 'NOTE',
            dateTime: new Date(),
            notes: 'Workflow: rejection email sent',
            createdBy: 'System',
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({ status: result.status })
  } catch (error) {
    console.error('Error updating status:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}

