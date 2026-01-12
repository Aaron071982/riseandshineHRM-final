import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  generateInterviewReminderEmail,
  EmailTemplateType,
} from '@/lib/email'

export async function GET(request: NextRequest) {
  // Verify this is a cron request (optional: add authentication)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)

    // Find interviews that are scheduled in the next 30 minutes and haven't had reminders sent
    const upcomingInterviews = await prisma.interview.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: now,
          lte: thirtyMinutesFromNow,
        },
        reminderSentAt: null,
      },
      include: {
        rbtProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (upcomingInterviews.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No interviews requiring reminders at this time',
        count: 0,
      })
    }

    // Get all admin emails
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        email: true,
      },
    })

    const adminEmails = admins.map((admin) => admin.email).filter(Boolean) as string[]

    let sentCount = 0
    let errorCount = 0

    // Send reminder emails for each interview
    for (const interview of upcomingInterviews) {
      try {
        // Send reminder to RBT
        if (interview.rbtProfile.email) {
          const rbtEmailContent = generateInterviewReminderEmail(
            interview.rbtProfile,
            {
              scheduledAt: interview.scheduledAt,
              durationMinutes: interview.durationMinutes,
              interviewerName: interview.interviewerName,
              meetingUrl: interview.meetingUrl,
            },
            false
          )

          await sendEmail({
            to: interview.rbtProfile.email,
            subject: rbtEmailContent.subject,
            html: rbtEmailContent.html,
            templateType: EmailTemplateType.INTERVIEW_INVITE, // Reusing this type for now
            rbtProfileId: interview.rbtProfileId,
          }).catch((error) => {
            console.error(`Failed to send reminder to RBT ${interview.rbtProfile.email}:`, error)
          })
        }

        // Send reminder to all admins
        for (const adminEmail of adminEmails) {
          const adminEmailContent = generateInterviewReminderEmail(
            interview.rbtProfile,
            {
              scheduledAt: interview.scheduledAt,
              durationMinutes: interview.durationMinutes,
              interviewerName: interview.interviewerName,
              meetingUrl: interview.meetingUrl,
            },
            true
          )

          await sendEmail({
            to: adminEmail,
            subject: adminEmailContent.subject,
            html: adminEmailContent.html,
            templateType: EmailTemplateType.INTERVIEW_INVITE, // Reusing this type for now
            rbtProfileId: interview.rbtProfileId,
          }).catch((error) => {
            console.error(`Failed to send reminder to admin ${adminEmail}:`, error)
          })
        }

        // Mark reminder as sent
        await prisma.interview.update({
          where: { id: interview.id },
          data: { reminderSentAt: now },
        })

        sentCount++
      } catch (error) {
        console.error(`Error processing reminder for interview ${interview.id}:`, error)
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${upcomingInterviews.length} interviews`,
      sentCount,
      errorCount,
    })
  } catch (error: any) {
    console.error('Error in send-interview-reminders cron job:', error)
    return NextResponse.json(
      { error: 'Failed to process interview reminders', details: error.message },
      { status: 500 }
    )
  }
}
