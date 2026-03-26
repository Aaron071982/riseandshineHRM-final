import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { getWorkflowSettings } from '@/lib/workflow-settings'
import { sendEmail, generateRejectionEmail, EmailTemplateType } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    const previousStatus = rbtProfile.status
    await prisma.rBTProfile.update({
      where: { id },
      data: { status: 'REJECTED' },
    })
    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: id,
        auditType: 'STATUS_CHANGE',
        dateTime: new Date(),
        notes: `Candidate rejected. Status changed from ${previousStatus} to REJECTED`,
        createdBy: user?.email || user?.name || 'Admin',
      },
    })

    // Optionally update user role to CANDIDATE if they were in another role
    // This keeps them in the system but marked as rejected
    if (rbtProfile.user && rbtProfile.user.role !== 'CANDIDATE') {
      await prisma.user.update({
        where: { id: rbtProfile.userId },
        data: { 
          role: 'CANDIDATE',
          isActive: false, // Deactivate the user account
        },
      })
    }

    // Send rejection email if workflow enabled and email is available
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
    console.error('Error rejecting candidate:', error)
    return NextResponse.json(
      { error: 'Failed to reject candidate' },
      { status: 500 }
    )
  }
}

