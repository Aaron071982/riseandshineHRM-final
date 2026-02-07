import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import {
  sendEmail,
  generateReachOutEmail,
  generateRejectionEmail,
  generateMissingOnboardingEmail,
  EmailTemplateType,
} from '@/lib/email'
import { randomBytes } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { templateType } = await request.json()

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: {
        onboardingTasks: true,
      },
    })

    if (!rbtProfile || !rbtProfile.email) {
      return NextResponse.json(
        { error: 'RBT profile not found or email missing' },
        { status: 404 }
      )
    }

    let emailContent

    // Generate scheduling token for REACH_OUT emails
    let schedulingToken: string | null = null
    if (templateType === EmailTemplateType.REACH_OUT) {
      schedulingToken = randomBytes(32).toString('hex')
    }

    switch (templateType) {
      case EmailTemplateType.REACH_OUT:
        emailContent = generateReachOutEmail(
          {
            firstName: rbtProfile.firstName,
            lastName: rbtProfile.lastName,
            email: rbtProfile.email,
            id: rbtProfile.id,
          },
          schedulingToken || ''
        )
        break
      case EmailTemplateType.REJECTION:
        emailContent = generateRejectionEmail(rbtProfile)
        break
      case EmailTemplateType.MISSING_ONBOARDING:
        // Get incomplete onboarding tasks
        const incompleteTasks = rbtProfile.onboardingTasks
          .filter(task => !task.isCompleted)
          .map(task => ({
            title: task.title,
            description: task.description,
            taskType: task.taskType,
          }))
        
        if (incompleteTasks.length === 0) {
          return NextResponse.json(
            { error: 'This RBT has no incomplete onboarding tasks' },
            { status: 400 }
          )
        }
        
        emailContent = generateMissingOnboardingEmail(rbtProfile, incompleteTasks)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid template type' },
          { status: 400 }
        )
    }

    console.log(`📧 Attempting to send ${templateType} email to ${rbtProfile.email}...`)
    
    const emailSent = await sendEmail({
      to: rbtProfile.email,
      subject: emailContent.subject,
      html: emailContent.html,
      templateType: templateType as EmailTemplateType,
      rbtProfileId: rbtProfile.id,
    })

    if (!emailSent) {
      console.error(`❌ Email sending failed for ${rbtProfile.email}`)
      return NextResponse.json({ 
        success: false,
        error: 'Email failed to send. Check server logs for details.',
        message: process.env.RESEND_API_KEY 
          ? 'Email sending failed - check Resend API key and configuration' 
          : 'RESEND_API_KEY not configured - email logged in dev mode only (check console)'
      }, { status: 500 })
    }

    console.log(`✅ Email sent successfully to ${rbtProfile.email}`)

    if (templateType === EmailTemplateType.REACH_OUT && schedulingToken) {
      const previousStatus = rbtProfile.status
      await prisma.rBTProfile.update({
        where: { id: rbtProfile.id },
        data: {
          status: 'REACH_OUT_EMAIL_SENT',
          schedulingToken,
        },
      })
      await prisma.rBTAuditLog.create({
        data: {
          rbtProfileId: rbtProfile.id,
          auditType: 'STATUS_CHANGE',
          dateTime: new Date(),
          notes: `Reach-out email sent. Status changed from ${previousStatus} to REACH_OUT_EMAIL_SENT`,
          createdBy: user?.email || user?.name || 'Admin',
        },
      })
      console.log(`✅ Updated RBT status to REACH_OUT_EMAIL_SENT and stored scheduling token`)
    }

    return NextResponse.json({ 
      success: true,
      message: process.env.RESEND_API_KEY 
        ? 'Email sent successfully via Resend' 
        : 'Email logged (dev mode - check console). Add RESEND_API_KEY to send real emails.'
    })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

