import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  generateInterviewInviteEmail,
  EmailTemplateType,
} from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, rbtId, scheduledAt, durationMinutes } = body

    if (!token || !rbtId || !scheduledAt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate token and RBT
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: {
        id: rbtId,
        schedulingToken: token,
      },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'Invalid or expired scheduling token' },
        { status: 404 }
      )
    }

    // Parse scheduled date
    const scheduledDate = new Date(scheduledAt)
    const now = new Date()

    // Validate date is in the future
    if (scheduledDate <= now) {
      return NextResponse.json(
        { error: 'Interview date must be in the future' },
        { status: 400 }
      )
    }

    // Validate day of week (Sunday = 0, Monday = 1, ..., Thursday = 4)
    const dayOfWeek = scheduledDate.getDay()
    if (dayOfWeek < 0 || dayOfWeek > 4) {
      return NextResponse.json(
        { error: 'Interviews are only available Sunday through Thursday' },
        { status: 400 }
      )
    }

    // Validate time (11:00 AM - 2:00 PM)
    const hours = scheduledDate.getHours()
    const minutes = scheduledDate.getMinutes()

    if (hours < 11 || hours > 14 || (hours === 14 && minutes > 0)) {
      return NextResponse.json(
        { error: 'Interview time must be between 11:00 AM and 2:00 PM' },
        { status: 400 }
      )
    }

    // Check for conflicting interviews
    const conflictingInterview = await prisma.interview.findFirst({
      where: {
        rbtProfileId: rbtId,
        status: 'SCHEDULED',
        scheduledAt: {
          gte: new Date(scheduledDate.getTime() - 60 * 60 * 1000), // 1 hour before
          lte: new Date(scheduledDate.getTime() + (durationMinutes || 60) * 60 * 1000), // Duration after
        },
      },
    })

    if (conflictingInterview) {
      return NextResponse.json(
        { error: 'You already have an interview scheduled at this time' },
        { status: 400 }
      )
    }

    // Get admin emails for notifications
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

    // Generate meeting URL (placeholder)
    const meetingUrl = `https://meet.google.com/${Math.random().toString(36).substring(7)}`

    // Create interview
    const interview = await prisma.interview.create({
      data: {
        rbtProfileId: rbtId,
        scheduledAt: scheduledDate,
        durationMinutes: durationMinutes || 60,
        interviewerName: 'Interviewer TBD', // Can be updated later by admin
        meetingUrl,
        status: 'SCHEDULED',
        decision: 'PENDING',
      },
    })

    // Update RBT status
    await prisma.rBTProfile.update({
      where: { id: rbtId },
      data: { status: 'INTERVIEW_SCHEDULED' },
    })

    // Send confirmation email to RBT
    if (rbtProfile.email) {
      const rbtEmailContent = generateInterviewInviteEmail(rbtProfile, {
        scheduledAt: scheduledDate,
        durationMinutes: durationMinutes || 60,
        interviewerName: 'Interviewer TBD',
        meetingUrl,
      })

      await sendEmail({
        to: rbtProfile.email,
        subject: rbtEmailContent.subject,
        html: rbtEmailContent.html,
        templateType: EmailTemplateType.INTERVIEW_INVITE,
        rbtProfileId: rbtId,
      }).catch((error) => {
        console.error(`Failed to send confirmation email to RBT:`, error)
      })
    }

    // Send notification emails to admins
    if (adminEmails.length > 0) {
      const adminEmailSubject = `New Interview Scheduled: ${rbtProfile.firstName} ${rbtProfile.lastName}`
      const adminEmailBody = `
        <h2>New Interview Scheduled</h2>
        <p><strong>RBT:</strong> ${rbtProfile.firstName} ${rbtProfile.lastName}</p>
        <p><strong>Date & Time:</strong> ${scheduledDate.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York',
        })}</p>
        <p><strong>Duration:</strong> ${durationMinutes || 60} minutes</p>
        <p><strong>Meeting URL:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>
      `

      await Promise.all(
        adminEmails.map((email) =>
          sendEmail({
            to: email,
            subject: adminEmailSubject,
            html: adminEmailBody,
            templateType: EmailTemplateType.INTERVIEW_INVITE,
            rbtProfileId: rbtId,
          }).catch((error) => {
            console.error(`Failed to send notification email to admin ${email}:`, error)
          })
        )
      )
    }

    return NextResponse.json({
      success: true,
      interviewId: interview.id,
      message: 'Interview scheduled successfully',
    })
  } catch (error: any) {
    console.error('Error scheduling interview:', error)
    return NextResponse.json(
      { error: 'Failed to schedule interview. Please try again.' },
      { status: 500 }
    )
  }
}
