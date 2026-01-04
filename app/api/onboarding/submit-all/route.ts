import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { sendEmail, EmailTemplateType } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get RBT profile
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id: user.rbtProfileId },
      include: {
        user: true,
      },
    })

    if (!rbtProfile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    // Get all documents and completions
    const documents = await prisma.onboardingDocument.findMany({
      where: { isActive: true },
    })

    const completions = await prisma.onboardingCompletion.findMany({
      where: {
        rbtProfileId: user.rbtProfileId,
        status: 'COMPLETED',
      },
      include: {
        document: true,
      },
    })

    // Verify all documents are completed
    if (completions.length !== documents.length) {
      return NextResponse.json(
        { error: 'Not all documents are completed' },
        { status: 400 }
      )
    }

    // Get admin emails
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        email: true,
        name: true,
      },
    })

    // Send email notification to admins
    const adminEmails = admins
      .map((admin) => admin.email)
      .filter((email): email is string => email !== null)

    if (adminEmails.length > 0) {
      const emailSubject = `Onboarding Documents Completed - ${rbtProfile.firstName} ${rbtProfile.lastName}`
      const emailBody = `
        <p>Hello,</p>
        <p>
          ${rbtProfile.firstName} ${rbtProfile.lastName} has completed all onboarding documents and submitted them for review.
        </p>
        <p><strong>Completed Documents:</strong></p>
        <ul>
          ${completions.map((c) => `<li>${c.document.title}</li>`).join('')}
        </ul>
        <p>
          Please review the completed documents in the admin dashboard.
        </p>
        <p>Best regards,<br>Rise and Shine HRM System</p>
      `

      // Send email to all admins
      for (const adminEmail of adminEmails) {
        await sendEmail({
          to: adminEmail,
          subject: emailSubject,
          html: emailBody,
          templateType: EmailTemplateType.REACH_OUT,
          rbtProfileId: rbtProfile.id,
        }).catch((error) => {
          console.error(`Failed to send email to ${adminEmail}:`, error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'All documents submitted successfully',
    })
  } catch (error: any) {
    console.error('Error submitting all documents:', error)
    return NextResponse.json(
      { error: 'Failed to submit documents' },
      { status: 500 }
    )
  }
}

