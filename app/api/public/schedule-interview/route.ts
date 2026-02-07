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

    // Parse scheduled date (ISO string from client)
    // The ISO string is in UTC, but represents a local time (e.g., 11:15 AM EST)
    // We need to parse it and get the local time representation
    const scheduledDate = new Date(scheduledAt)
    const now = new Date()
    
    // Format the date in America/New_York timezone to get the actual local time
    const scheduledDateStr = scheduledDate.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    // Parse the formatted string to get components (MM/DD/YYYY, HH:MM)
    const [datePart, timePart] = scheduledDateStr.split(', ')
    const [month, day, year] = datePart.split('/').map(Number)
    const [hours, minutes] = timePart.split(':').map(Number)
    
    // Create a date object in NY timezone for validation
    const scheduledDateNY = new Date(year, month - 1, day, hours, minutes)
    
    // Get date-only for comparison (ignore time)
    const scheduledDateOnly = new Date(year, month - 1, day)
    const nowNY = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const todayOnly = new Date(nowNY.getFullYear(), nowNY.getMonth(), nowNY.getDate())

    // Validate date is today or in the future
    if (scheduledDateOnly < todayOnly) {
      return NextResponse.json(
        { error: 'Interview date must be today or in the future' },
        { status: 400 }
      )
    }
    
    // If scheduled for today, ensure time is in the future
    if (scheduledDateOnly.getTime() === todayOnly.getTime() && scheduledDate <= now) {
      return NextResponse.json(
        { error: 'Interview time must be in the future' },
        { status: 400 }
      )
    }

    // Validate day of week (Sunday = 0, Monday = 1, ..., Thursday = 4)
    const dayOfWeek = scheduledDateNY.getDay()
    if (dayOfWeek < 0 || dayOfWeek > 4) {
      return NextResponse.json(
        { error: 'Interviews are only available Sunday through Thursday' },
        { status: 400 }
      )
    }

    // Validate time (11:00 AM - 2:00 PM, 30-minute intervals only)
    if (hours < 11 || hours > 14 || (hours === 14 && minutes > 0)) {
      return NextResponse.json(
        { error: 'Interview time must be between 11:00 AM and 2:00 PM' },
        { status: 400 }
      )
    }

    if (minutes !== 0 && minutes !== 30) {
      return NextResponse.json(
        { error: 'Interview time must be on a 30-minute interval (e.g., 11:00, 11:30, 12:00)' },
        { status: 400 }
      )
    }

    const slotStartTime = new Date(scheduledDate)
    slotStartTime.setSeconds(0, 0)
    const slotEndTime = new Date(slotStartTime.getTime() + 30 * 60 * 1000)

    const conflictingForRbt = await prisma.interview.findFirst({
      where: {
        rbtProfileId: rbtId,
        status: 'SCHEDULED',
        scheduledAt: { gte: slotStartTime, lt: slotEndTime },
      },
    })
    if (conflictingForRbt) {
      return NextResponse.json(
        { error: 'You already have an interview scheduled at this time' },
        { status: 400 }
      )
    }

    const slotStartMinus30 = new Date(slotStartTime.getTime() - 30 * 60 * 1000)
    const overlapping = await prisma.interview.findFirst({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gt: slotStartMinus30, lt: slotEndTime },
      },
    })
    if (overlapping) {
      return NextResponse.json(
        { error: 'This time slot is already taken. Please choose another 30-minute slot.' },
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

    // Use the standard meeting URL for all interviews
    const meetingUrl = 'https://meet.google.com/gtz-kmij-tvd'

    const interview = await prisma.interview.create({
      data: {
        rbtProfileId: rbtId,
        scheduledAt: scheduledDate,
        durationMinutes: durationMinutes || 30,
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
        durationMinutes: durationMinutes || 30,
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
