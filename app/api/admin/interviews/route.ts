import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import {
  sendEmail,
  generateInterviewInviteEmail,
  EmailTemplateType,
} from '@/lib/email'

export async function POST(request: NextRequest) {
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

    const data = await request.json()

    // Generate a placeholder meeting URL if not provided
    const meetingUrl =
      data.meetingUrl || `https://meet.google.com/${Math.random().toString(36).substring(7)}`

    // Create interview
    const interview = await prisma.interview.create({
      data: {
        rbtProfileId: data.rbtProfileId,
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: data.durationMinutes || 60,
        interviewerName: data.interviewerName,
        meetingUrl,
        status: 'SCHEDULED',
        decision: 'PENDING',
      },
    })

    // Update RBT profile status to INTERVIEW_SCHEDULED
    await prisma.rBTProfile.update({
      where: { id: data.rbtProfileId },
      data: { status: 'INTERVIEW_SCHEDULED' },
    })

    // Send interview invite email
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id: data.rbtProfileId },
    })

    if (rbtProfile && rbtProfile.email) {
      const emailContent = generateInterviewInviteEmail(rbtProfile, {
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: data.durationMinutes || 60,
        interviewerName: data.interviewerName,
        meetingUrl,
      })

      await sendEmail({
        to: rbtProfile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        templateType: EmailTemplateType.INTERVIEW_INVITE,
        rbtProfileId: rbtProfile.id,
      })
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

