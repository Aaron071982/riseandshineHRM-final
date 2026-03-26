import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  generateInterviewInviteEmail,
  EmailTemplateType,
} from '@/lib/email'
import { sendGenericEmail } from '@/lib/email/core'
import { generateInterviewBookedForInterviewerEmail } from '@/lib/email/generators'
import { makePublicUrl } from '@/lib/baseUrl'
import { easternToUTC, getEasternDate } from '@/lib/eastern-time'

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, rbtId, slotId, scheduledAt, durationMinutes } = body

    if (!token || !rbtId || (!slotId && !scheduledAt)) {
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

    if (slotId) {
      const slotIdStr = String(slotId)
      const firstUnderscoreIdx = slotIdStr.indexOf('_')
      if (firstUnderscoreIdx <= 0) {
        return NextResponse.json({ error: 'Invalid slot id' }, { status: 400 })
      }

      const interviewerId = slotIdStr.slice(0, firstUnderscoreIdx)
      const slotStartIso = slotIdStr.slice(firstUnderscoreIdx + 1)
      const slotStartUTC = new Date(slotStartIso)
      if (!interviewerId || Number.isNaN(slotStartUTC.getTime())) {
        return NextResponse.json({ error: 'Invalid slot id' }, { status: 400 })
      }

      const slotDurationMinutes = await prisma.interviewerSettings
        .findUnique({ where: { userId: interviewerId } })
        .then((s) => s?.slotDurationMinutes ?? 15)

      const slotEndUTC = new Date(slotStartUTC.getTime() + slotDurationMinutes * 60 * 1000)

      if (slotStartUTC < new Date()) {
        return NextResponse.json({ error: 'Interview time must be in the future' }, { status: 400 })
      }

      const interviewerUser = await prisma.user.findUnique({
        where: { id: interviewerId },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          interviewerSettings: { select: { acceptInterviewBookings: true, bufferMinutes: true, slotDurationMinutes: true } },
        },
      })

      if (!interviewerUser || !interviewerUser.isActive) {
        return NextResponse.json({ error: 'Invalid interviewer' }, { status: 400 })
      }

      if (interviewerUser.interviewerSettings && interviewerUser.interviewerSettings.acceptInterviewBookings === false) {
        return NextResponse.json({ error: 'Interviewer is not accepting bookings' }, { status: 400 })
      }

      const interviewerFirstName = (interviewerUser.name || 'Interviewer').split(/\\s+/)[0]

      const easternYMD = getEasternDate(slotStartUTC)
      const easternMiddayUTC = easternToUTC(easternYMD.year, easternYMD.month, easternYMD.day, 12, 0)
      const dayOfWeek = easternMiddayUTC.getUTCDay()

      const easternTime = slotStartUTC.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const [hourStr, minuteStr] = easternTime.split(':')
      const slotHour = Number(hourStr)
      const slotMinute = Number(minuteStr)
      const slotLocalMinutes = slotHour * 60 + slotMinute

      const availabilityWindows = await prisma.interviewerAvailability.findMany({
        where: { userId: interviewerId, isActive: true },
        select: {
          id: true,
          dayOfWeek: true,
          startHour: true,
          startMinute: true,
          endHour: true,
          endMinute: true,
        },
      })

      const matchingAvailability = availabilityWindows.find((av) => {
        if (av.dayOfWeek !== dayOfWeek) return false
        const windowStart = av.startHour * 60 + av.startMinute
        const windowEnd = av.endHour * 60 + av.endMinute
        return slotLocalMinutes >= windowStart && slotLocalMinutes + slotDurationMinutes <= windowEnd
      })

      if (!matchingAvailability) {
        return NextResponse.json({ error: 'This slot is no longer available' }, { status: 400 })
      }

      const interviewerBookedConflicts = await prisma.interview.findMany({
        where: {
          claimedByUserId: interviewerId,
          status: 'SCHEDULED',
          scheduledAt: {
            gte: new Date(slotStartUTC.getTime() - 2 * 60 * 60 * 1000),
            lt: slotEndUTC,
          },
        },
        select: { scheduledAt: true, durationMinutes: true },
      })

      const interviewerIsBooked = interviewerBookedConflicts.some((existing) => {
        const start = new Date(existing.scheduledAt)
        const end = new Date(start.getTime() + (existing.durationMinutes ?? 15) * 60 * 1000)
        return intervalsOverlap(start, end, slotStartUTC, slotEndUTC)
      })

      if (interviewerIsBooked) {
        return NextResponse.json({ error: 'This time slot is already taken.' }, { status: 400 })
      }

      const rbtConflicts = await prisma.interview.findMany({
        where: {
          rbtProfileId: rbtId,
          status: 'SCHEDULED',
          scheduledAt: {
            gte: new Date(slotStartUTC.getTime() - 2 * 60 * 60 * 1000),
            lt: slotEndUTC,
          },
        },
        select: { scheduledAt: true, durationMinutes: true },
      })

      const rbtAlreadyBookedOverlaps = rbtConflicts.some((existing) => {
        const start = new Date(existing.scheduledAt)
        const end = new Date(start.getTime() + (existing.durationMinutes ?? 15) * 60 * 1000)
        return intervalsOverlap(start, end, slotStartUTC, slotEndUTC)
      })

      if (rbtAlreadyBookedOverlaps) {
        return NextResponse.json({ error: 'You already have an interview scheduled at this time.' }, { status: 400 })
      }

      await prisma.interview.updateMany({
        where: { rbtProfileId: rbtId, status: 'SCHEDULED' },
        data: { status: 'CANCELED' },
      })

      const meetingUrl = 'https://meet.google.com/gtz-kmij-tvd'
      const createdAt = new Date()
      const slotDate = new Date(Date.UTC(easternYMD.year, easternYMD.month - 1, easternYMD.day))

      const interview = await prisma.$transaction(async (tx) => {
        const newInterview = await tx.interview.create({
          data: {
            rbtProfileId: rbtId,
            scheduledAt: slotStartUTC,
            durationMinutes: slotDurationMinutes,
            interviewerName: interviewerFirstName,
            meetingUrl,
            status: 'SCHEDULED',
            decision: 'PENDING',
            claimedByUserId: interviewerId,
          },
        })

        await tx.interviewSlot.create({
          data: {
            interviewerAvailabilityId: matchingAvailability.id,
            userId: interviewerId,
            slotDate,
            startTime: slotStartUTC,
            endTime: slotEndUTC,
            isBooked: true,
            bookedByRbtProfileId: rbtId,
            bookedAt: createdAt,
          },
        })

        await tx.rBTProfile.update({
          where: { id: rbtId },
          data: { status: 'INTERVIEW_SCHEDULED' },
        })

        const rbtFullName = `${rbtProfile.firstName} ${rbtProfile.lastName}`
        await tx.adminNotification.create({
          data: {
            userId: interviewerId,
            type: 'INTERVIEW_BOOKED',
            message: `New interview booked: ${rbtFullName} (${slotStartUTC.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })})`,
            linkUrl: `/admin/rbts/${rbtId}`,
          },
        })

        return newInterview
      })

      // Send confirmation email to the RBT
      if (rbtProfile.email) {
        const rbtEmailContent = generateInterviewInviteEmail(rbtProfile, {
          scheduledAt: slotStartUTC,
          durationMinutes: slotDurationMinutes,
          interviewerName: interviewerFirstName,
          meetingUrl,
          interviewId: interview.id,
          calendarToken: token,
          rescheduleUrl: makePublicUrl(
            `/schedule-interview?token=${encodeURIComponent(token)}&rbtId=${encodeURIComponent(rbtId)}&reschedule=1`
          ),
        })

        await sendEmail({
          to: rbtProfile.email,
          subject: rbtEmailContent.subject,
          html: rbtEmailContent.html,
          templateType: EmailTemplateType.INTERVIEW_INVITE,
          rbtProfileId: rbtId,
        }).catch((error) => {
          console.error('Failed to send interview confirmation email to RBT:', error)
        })
      }

      // Send notification email to the interviewer (assigned admin)
      if (interviewerUser.email) {
        const { subject, html } = generateInterviewBookedForInterviewerEmail(
          {
            id: rbtProfile.id,
            firstName: rbtProfile.firstName,
            lastName: rbtProfile.lastName,
            phoneNumber: rbtProfile.phoneNumber,
            email: rbtProfile.email,
          },
          {
            scheduledAt: slotStartUTC,
            durationMinutes: slotDurationMinutes,
            meetingUrl,
          },
          {
            rbtProfileLink: makePublicUrl(`/admin/rbts/${rbtProfile.id}`),
          }
        )
        await sendGenericEmail(interviewerUser.email, subject, html).catch((error) => {
          console.error('Failed to send interview booked email to interviewer:', error)
        })
      }

      return NextResponse.json({
        success: true,
        interviewId: interview.id,
        scheduledAt: slotStartUTC.toISOString(),
        durationMinutes: slotDurationMinutes,
        interviewerName: interviewerFirstName,
        interviewerId,
        meetingUrl,
      })
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

    // Send enhanced notification emails to admins + in-app notifications
    const candidateName = `${rbtProfile.firstName} ${rbtProfile.lastName}`
    const interviewLink = makePublicUrl(`/admin/interviews`)
    const claimLink = makePublicUrl(`/admin/interviews`)

    const adminsWithIds = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, email: true, name: true },
    })

    for (const admin of adminsWithIds) {
      try {
        if (admin.email) {
          const { subject, html } = generateInterviewBookedForInterviewerEmail(
            {
              id: rbtProfile.id,
              firstName: rbtProfile.firstName,
              lastName: rbtProfile.lastName,
              phoneNumber: rbtProfile.phoneNumber,
              email: rbtProfile.email,
            },
            {
              scheduledAt: scheduledDate,
              durationMinutes: durationMinutes || 30,
              meetingUrl,
            },
            {
              rbtProfileLink: makePublicUrl(`/admin/rbts/${rbtProfile.id}`),
            }
          )
          await sendGenericEmail(admin.email, subject, html)
        }
        await prisma.adminNotification.create({
          data: {
            userId: admin.id,
            type: 'INTERVIEW_SCHEDULED',
            message: `New interview scheduled: ${candidateName} at ${scheduledDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}`,
            linkUrl: '/admin/interviews',
          },
        })
      } catch (e) {
        console.error(`Failed to notify admin ${admin.email}:`, e)
      }
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
