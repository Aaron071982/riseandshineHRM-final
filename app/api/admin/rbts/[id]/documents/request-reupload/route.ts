import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendGenericEmail } from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'

/** POST: Set onboarding completion back to NOT_STARTED, email RBT, create notification and audit log. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const adminUser = auth.user

    const { id: rbtProfileId } = await params
    const body = await request.json().catch(() => ({}))
    const completionId = typeof body.completionId === 'string' ? body.completionId.trim() : ''
    if (!completionId) {
      return NextResponse.json(
        { error: 'completionId is required' },
        { status: 400 }
      )
    }

    const completion = await prisma.onboardingCompletion.findUnique({
      where: { id: completionId },
      include: { document: true, rbtProfile: true },
    })
    if (
      !completion ||
      completion.rbtProfileId !== rbtProfileId ||
      completion.status !== 'COMPLETED'
    ) {
      return NextResponse.json(
        { error: 'Completion not found or not completed' },
        { status: 404 }
      )
    }

    await prisma.onboardingCompletion.update({
      where: { id: completionId },
      data: { status: 'NOT_STARTED', signedPdfUrl: null, completedAt: null },
    })

    const tasksUrl = makePublicUrl('/rbt/tasks')
    const docTitle = completion.document.title
    const firstName = completion.rbtProfile.firstName
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">Rise and Shine</h1>
          </div>
          <div style="padding: 24px; background: #fff; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hi <strong>${firstName}</strong>,</p>
            <p><strong>${docTitle}</strong> needs to be re-uploaded. Please log in to the portal and resubmit this document.</p>
            <p><a href="${tasksUrl}" style="display: inline-block; padding: 12px 24px; background: #E4893D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to My Tasks</a></p>
            <p style="margin-top: 24px; font-size: 14px; color: #666;">Best regards,<br>The Rise and Shine Team</p>
          </div>
        </div>
      </body>
      </html>
    `
    const to = completion.rbtProfile.email
    if (to) {
      await sendGenericEmail(
        to,
        `Action required: ${docTitle} needs to be re-uploaded`,
        html
      ).catch((e) => console.error('Request re-upload email failed:', e))
    }

    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId,
        auditType: 'NOTE',
        dateTime: new Date(),
        notes: `Admin requested re-upload of document: ${docTitle}. Completion reset to NOT_STARTED.`,
        createdBy: adminUser.email ?? adminUser.name ?? 'Admin',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/rbts/documents/request-reupload] error:', error)
    return NextResponse.json(
      { error: 'Failed to request re-upload' },
      { status: 500 }
    )
  }
}
