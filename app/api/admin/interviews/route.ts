import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import {
  sendEmail,
  generateInterviewInviteEmail,
  EmailTemplateType,
} from '@/lib/email'
import { sendGenericEmail } from '@/lib/email/core'
import { generateInterviewScheduledAdminEmail } from '@/lib/email/generators'
import { makePublicUrl } from '@/lib/baseUrl'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user
    const data = await request.json()
    const scheduledAt = new Date(data.scheduledAt)
    const durationMinutes = data.durationMinutes ?? 30

    if (durationMinutes !== 30) {
      return NextResponse.json(
        { error: 'Interviews must be 30 minutes. Please use 30-minute slots only.' },
        { status: 400 }
      )
    }

    const meetingUrl = 'https://meet.google.com/gtz-kmij-tvd'
    const slotEnd = new Date(scheduledAt.getTime() + 30 * 60 * 1000)
    const slotStartMinus30 = new Date(scheduledAt.getTime() - 30 * 60 * 1000)

    const overlapping = await prisma.interview.findFirst({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gt: slotStartMinus30, lt: slotEnd },
      },
    })

    if (overlapping) {
      return NextResponse.json(
        { error: 'This time slot is already taken. Please choose another 30-minute slot (e.g. 11:00, 11:30, 12:00).' },
        { status: 400 }
      )
    }

    const rbtBefore = await prisma.rBTProfile.findUnique({
      where: { id: data.rbtProfileId },
      select: { status: true },
    })
    const previousStatus = rbtBefore?.status ?? 'UNKNOWN'

    const interview = await prisma.interview.create({
      data: {
        rbtProfileId: data.rbtProfileId,
        scheduledAt,
        durationMinutes: 30,
        interviewerName: data.interviewerName,
        meetingUrl,
        status: 'SCHEDULED',
        decision: 'PENDING',
      },
    })

    await prisma.rBTProfile.update({
      where: { id: data.rbtProfileId },
      data: { status: 'INTERVIEW_SCHEDULED' },
    })
    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: data.rbtProfileId,
        auditType: 'STATUS_CHANGE',
        dateTime: new Date(),
        notes: `Interview scheduled. Status changed from ${previousStatus} to INTERVIEW_SCHEDULED`,
        createdBy: user?.email || user?.name || 'Admin',
      },
    })

    // Send interview invite email
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id: data.rbtProfileId },
    })

    if (rbtProfile && rbtProfile.email) {
      console.log(`📧 Sending interview invite email to ${rbtProfile.email}...`)
      
      const emailContent = generateInterviewInviteEmail(rbtProfile, {
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: 30,
        interviewerName: data.interviewerName,
        meetingUrl,
      })

      const emailSent = await sendEmail({
        to: rbtProfile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        templateType: EmailTemplateType.INTERVIEW_INVITE,
        rbtProfileId: rbtProfile.id,
      })
      
      if (!emailSent) {
        console.error(`❌ Failed to send interview invite email to ${rbtProfile.email}`)
        // Still return success for interview creation, but log the email failure
      } else {
        console.log(`✅ Interview invite email sent successfully to ${rbtProfile.email}`)
      }
    } else {
      console.warn(`⚠️ No email address found for RBT profile ${data.rbtProfileId} - interview created but no email sent`)
    }

    // Notify all other admins about the new interview
    try {
      if (!rbtProfile) {
        console.warn(`Skipping admin notifications: RBT profile not found for ${data.rbtProfileId}`)
      } else {
        const candidateName = `${rbtProfile.firstName} ${rbtProfile.lastName}`
        const interviewLink = makePublicUrl(`/admin/interviews`)
        const claimLink = makePublicUrl(`/admin/interviews`)

        const allAdmins = await prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true, email: true, name: true },
        })

        for (const admin of allAdmins) {
          if (admin.id === user.id) continue
          try {
            if (admin.email) {
              const { subject, html } = generateInterviewScheduledAdminEmail(
                candidateName,
                scheduledAt,
                interview.meetingUrl,
                interviewLink,
                claimLink
              )
              await sendGenericEmail(admin.email, subject, html)
            }

            await prisma.adminNotification.create({
              data: {
                userId: admin.id,
                type: 'INTERVIEW_SCHEDULED',
                message: `New interview scheduled: ${candidateName} at ${scheduledAt.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'America/New_York',
                })}`,
                linkUrl: '/admin/interviews',
              },
            })
          } catch (e) {
            console.error(`Failed to notify admin ${admin.email}:`, e)
          }
        }
      }
    } catch (e) {
      console.error('Failed to send admin notifications:', e)
    }

    return NextResponse.json({ id: interview.id, success: true })
  } catch (error) {
    console.error('Error creating interview:', error)
    return NextResponse.json(
      { error: 'Failed to schedule interview' },
      { status: 500 }
    )
  }
}

