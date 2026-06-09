import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import {
  sendEmail,
  generateReachOutEmail,
  generateRejectionEmail,
  generateMissingOnboardingEmail,
  generateSocialSecurityUploadReminderEmail,
  EmailTemplateType,
} from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'
import { ensureSocialSecurityOnboardingTask } from '@/lib/onboarding/socialSecurityTask'
import {
  getOnboardingProgress,
  incompleteRbtOnboardingSteps,
  isSocialSecurityUploadComplete,
} from '@/lib/onboarding/progress'
import { randomBytes } from 'crypto'

type RbtProfileWithTasks = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  status?: string
  onboardingTasks: Array<{ title: string; description: string | null; taskType: string; isCompleted: boolean }>
}

async function loadRbtProfileForEmail(id: string): Promise<RbtProfileWithTasks | null> {
  try {
    const profile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: { onboardingTasks: true },
    })
    if (profile) return profile as RbtProfileWithTasks
  } catch (err) {
    console.error('Send-email: Prisma findUnique failed', err)
  }

  try {
    const profileOnly = await prisma.rBTProfile.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, email: true, status: true },
    })
    if (!profileOnly) return null
    const onboardingTasks = await prisma.onboardingTask.findMany({
      where: { rbtProfileId: id },
      select: { title: true, description: true, taskType: true, isCompleted: true },
    })
    return { ...profileOnly, onboardingTasks }
  } catch (fallbackErr) {
    console.error('Send-email: fallback load failed', fallbackErr)
    return null
  }
}

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
    const templateType = body?.templateType as string | undefined

    if (!templateType) {
      return NextResponse.json({ error: 'templateType is required' }, { status: 400 })
    }

    const rbtProfile = await loadRbtProfileForEmail(id)

    if (!rbtProfile || !rbtProfile.email) {
      return NextResponse.json(
        { error: 'RBT profile not found or email missing' },
        { status: 404 }
      )
    }

    let emailContent: { subject: string; html: string }

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
      case EmailTemplateType.MISSING_ONBOARDING: {
        let incompleteTasks = (rbtProfile.onboardingTasks || [])
          .filter((task) => !task.isCompleted)
          .map((task) => ({
            title: task.title,
            description: task.description,
            taskType: task.taskType,
          }))
        if (incompleteTasks.length === 0) {
          try {
            const progress = await getOnboardingProgress(rbtProfile.id)
            if (!progress.fullyActivated) {
              incompleteTasks = incompleteRbtOnboardingSteps(progress)
            }
          } catch (progressErr) {
            console.error('Send-email: onboarding progress load failed', progressErr)
          }
        }
        if (incompleteTasks.length === 0) {
          return NextResponse.json(
            { error: 'This RBT has no incomplete onboarding tasks' },
            { status: 400 }
          )
        }
        emailContent = generateMissingOnboardingEmail(rbtProfile, incompleteTasks)
        break
      }
      case EmailTemplateType.SOCIAL_SECURITY_UPLOAD_REMINDER: {
        try {
          await ensureSocialSecurityOnboardingTask(prisma, rbtProfile.id)
        } catch (taskErr) {
          console.error('Send-email: ensure SSN task failed (continuing)', taskErr)
        }

        const ssnLegacyTask = (rbtProfile.onboardingTasks || []).find(
          (task) => task.taskType === 'SOCIAL_SECURITY_DOCUMENT'
        )
        let ssnAlreadyUploaded = ssnLegacyTask?.isCompleted === true

        if (!ssnAlreadyUploaded) {
          try {
            const progress = await getOnboardingProgress(rbtProfile.id)
            ssnAlreadyUploaded = isSocialSecurityUploadComplete(progress)
          } catch (progressErr) {
            console.error('Send-email: SSN progress check failed', progressErr)
          }
        }

        if (ssnAlreadyUploaded) {
          return NextResponse.json(
            { error: 'Social Security card has already been uploaded for this RBT.' },
            { status: 400 }
          )
        }

        const tasksUrl = makePublicUrl('/rbt/tasks')
        emailContent = generateSocialSecurityUploadReminderEmail(rbtProfile.firstName, tasksUrl)
        break
      }
      default:
        return NextResponse.json(
          { error: 'Invalid template type' },
          { status: 400 }
        )
    }


    let emailSent = false
    try {
      emailSent = await sendEmail({
        to: rbtProfile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        templateType: templateType as EmailTemplateType,
        rbtProfileId: rbtProfile.id,
      })
    } catch (sendErr) {
      console.error('Send-email: sendEmail threw', sendErr)
      const msg = sendErr instanceof Error ? sendErr.message : 'Email service error'
      return NextResponse.json(
        { error: process.env.NODE_ENV === 'development' ? msg : 'Email failed to send. Try again later.' },
        { status: 500 }
      )
    }

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
