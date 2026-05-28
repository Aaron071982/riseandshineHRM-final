import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { getWorkflowSettings } from '@/lib/workflow-settings'
import { sendEmail, sendGenericEmail, generateOfferEmail, EmailTemplateType } from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'
import { provisionOnboardingForHiredRbt } from '@/lib/onboarding/provision'

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

    if (!rbtProfile.email) {
      return NextResponse.json(
        { error: 'RBT profile must have an email address to be hired' },
        { status: 400 }
      )
    }

    // Ensure User exists and has correct email, then update role to RBT
    // This is critical: the User.email must match RBTProfile.email for login to work
    try {
      // First, check if email is already in use by a different user
      if (rbtProfile.email) {
        const existingUserWithEmail = await prisma.user.findUnique({
          where: { email: rbtProfile.email },
        })
        
        if (existingUserWithEmail && existingUserWithEmail.id !== rbtProfile.userId) {
          console.error(`Email ${rbtProfile.email} is already associated with user ${existingUserWithEmail.id}`)
          return NextResponse.json(
            { error: 'Email is already associated with another account' },
            { status: 400 }
          )
        }
      }

      // Normalize email to lowercase so login (verify-otp) matches regardless of casing
      const normalizedEmail = rbtProfile.email ? rbtProfile.email.trim().toLowerCase() : undefined
      // Update user with all required fields
      const updatedUser = await prisma.user.update({
        where: { id: rbtProfile.userId },
        data: { 
          role: 'RBT',
          email: normalizedEmail || rbtProfile.email || undefined, // Sync email - required for login
          isActive: true, // Ensure user is active
        },
      })
    } catch (error: any) {
      console.error('❌ Error updating user during hire:', error)
      
      // If email conflict, try updating without email first
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        try {
          const updatedUser = await prisma.user.update({
            where: { id: rbtProfile.userId },
            data: { 
              role: 'RBT',
              isActive: true,
            },
          })
        } catch (secondError: any) {
          console.error('❌ Failed to update user even without email:', secondError)
          return NextResponse.json(
            { error: 'Failed to update user account. Please contact support.' },
            { status: 500 }
          )
        }
      } else {
        console.error('❌ Failed to update user role during hire:', error)
        return NextResponse.json(
          { error: 'Failed to update user account. Please try again or contact support.' },
          { status: 500 }
        )
      }
    }

    const previousStatus = rbtProfile.status
    await prisma.rBTProfile.update({
      where: { id },
      data: { status: 'HIRED' },
    })
    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: id,
        auditType: 'STATUS_CHANGE',
        dateTime: new Date(),
        notes: `Candidate hired. Status changed from ${previousStatus} to HIRED`,
        createdBy: user?.email || user?.name || 'Admin',
      },
    })

    try {
      await provisionOnboardingForHiredRbt(rbtProfile.id)
    } catch (onboardingErr) {
      console.error('Error provisioning onboarding catalog:', onboardingErr)
    }

    const workflow = await getWorkflowSettings()

    // Send welcome email (gated by workflow)
    if (workflow.emailHired && rbtProfile.email) {
      const emailContent = generateOfferEmail(rbtProfile)
      await sendEmail({
        to: rbtProfile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        templateType: EmailTemplateType.OFFER,
        rbtProfileId: rbtProfile.id,
      })
    }

    // Notify all admins (email + in-app notification)
    if (workflow.notifyAdminsHired) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, email: true },
      })
      const profileUrl = makePublicUrl(`/admin/rbts/${rbtProfile.id}`)
      const rbtName = `${rbtProfile.firstName} ${rbtProfile.lastName}`
      const adminSubject = `New RBT hired: ${rbtName}`
      const adminHtml = `
        <p>${rbtName} has been hired and added to the Rise and Shine team.</p>
        <p><a href="${profileUrl}" style="color: #E4893D;">View profile</a></p>
      `
      for (const admin of admins) {
        if (admin.email) {
          sendGenericEmail(admin.email, adminSubject, `<div style="font-family: sans-serif;">${adminHtml}</div>`).catch((e) =>
            console.error('Admin hire notification email failed:', e)
          )
        }
        await prisma.adminNotification.create({
          data: {
            userId: admin.id,
            type: 'CANDIDATE_HIRED',
            message: `Candidate hired: ${rbtName}`,
            linkUrl: profileUrl,
          },
        }).catch((e) => console.error('Admin notification create failed:', e))
      }
    }

    // Track form submission
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'FORM_SUBMISSION',
          action: `Hired RBT: ${rbtProfile.firstName} ${rbtProfile.lastName}`,
          resourceType: 'RBTProfile',
          resourceId: id,
          ipAddress,
          userAgent: request.headers.get('user-agent') || null,
          metadata: {
            rbtEmail: rbtProfile.email,
            previousStatus: rbtProfile.status,
            newStatus: 'HIRED',
          },
        },
      })
    } catch (error) {
      console.error('Failed to track hire action:', error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error hiring RBT:', error)
    return NextResponse.json(
      { error: 'Failed to hire RBT' },
      { status: 500 }
    )
  }
}

