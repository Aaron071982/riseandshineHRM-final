import { NextRequest, NextResponse } from 'next/server'
import { RBTStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { getWorkflowSettings } from '@/lib/workflow-settings'
import { sendEmail, generateRejectionEmail, EmailTemplateType } from '@/lib/email'

const TERMINABLE_STATUSES = ['HIRED', 'ONBOARDING_COMPLETED'] as const

/**
 * Simple terminate (legacy). Prefer POST /termination for the full offboarding workflow.
 * Kept as a reliable fallback that only needs FIRED + terminationReason columns.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (!reason) {
      return NextResponse.json({ error: 'Reason for termination is required' }, { status: 400 })
    }

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!rbtProfile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    if (!TERMINABLE_STATUSES.includes(rbtProfile.status as (typeof TERMINABLE_STATUSES)[number])) {
      return NextResponse.json(
        { error: 'Only hired or onboarding-completed RBTs can be terminated' },
        { status: 400 }
      )
    }

    const actor = user?.email || user?.name || 'Admin'
    const previousStatus = rbtProfile.status
    const terminatedAt = new Date()

    await prisma.rBTProfile.update({
      where: { id },
      data: {
        status: RBTStatus.FIRED,
        postHireStage: 'MATCHING',
        activeWorkingSince: null,
        activeWorkingManualOverride: true,
        terminationReason: reason,
        terminatedAt,
        terminatedBy: actor,
      },
    })

    await prisma.clientAssignment.deleteMany({ where: { rbtProfileId: id } }).catch(() => undefined)

    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: id,
        auditType: 'STATUS_CHANGE',
        dateTime: terminatedAt,
        notes: `RBT terminated. Status changed from ${previousStatus} to FIRED. Reason: ${reason}`,
        createdBy: actor,
      },
    })

    if (rbtProfile.user) {
      await prisma.user.update({
        where: { id: rbtProfile.userId },
        data: { role: 'CANDIDATE', isActive: false },
      })
    }

    const workflow = await getWorkflowSettings()
    if (workflow.emailRejection && rbtProfile.email) {
      const emailContent = generateRejectionEmail(rbtProfile)
      await sendEmail({
        to: rbtProfile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        templateType: EmailTemplateType.REJECTION,
        rbtProfileId: rbtProfile.id,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error terminating RBT:', error)
    const message = error instanceof Error ? error.message : 'Failed to terminate RBT'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
