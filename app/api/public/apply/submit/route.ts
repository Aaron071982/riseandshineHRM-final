import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  generateApplicationSubmissionInternalEmail,
  generateApplicationSubmissionConfirmationEmail,
} from '@/lib/email'
import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'noreply@riseandshinehrm.com'
const adminEmail = process.env.ADMIN_EMAIL || 'aaronsiam21@gmail.com'

let resend: Resend | null = null
if (resendApiKey) {
  resend = new Resend(resendApiKey)
}

// Simple in-memory rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  return `submit:${ip}`
}

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 submissions per IP per hour
    const rateLimitKey = getRateLimitKey(request)
    if (!checkRateLimit(rateLimitKey, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Honeypot check
    if (body.website) {
      // Bot detected - silently reject
      return NextResponse.json({ success: true, id: 'fake-id' })
    }

    // Validate required fields
    const requiredFields = [
      'firstName',
      'lastName',
      'email',
      'phoneNumber',
      'zipCode',
      'addressLine1',
      'fortyHourCourseCompleted',
      'authorizedToWork',
      'canPassBackgroundCheck',
      'resumeUrl',
    ]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
      include: { rbtProfile: true },
    })

    // If user exists and has an RBT profile, don't create duplicate
    if (existingUser?.rbtProfile) {
      return NextResponse.json(
        { error: 'An application with this email already exists.' },
        { status: 400 }
      )
    }

    // Create or update user
    let userRecord
    if (!existingUser) {
      userRecord = await prisma.user.create({
        data: {
          email: body.email,
          phoneNumber: body.phoneNumber,
          name: `${body.firstName} ${body.lastName}`,
          role: 'CANDIDATE',
          isActive: true,
        },
      })
    } else {
      // Update existing user
      userRecord = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          phoneNumber: body.phoneNumber,
          name: `${body.firstName} ${body.lastName}`,
        },
      })
    }

    // Prepare availability JSON
    const availabilityJson = {
      weekday: body.weekdayAvailability || {},
      weekend: body.weekendAvailability || {},
      preferredHoursRange: body.preferredHoursRange,
      earliestStartTime: body.earliestStartTime,
      latestEndTime: body.latestEndTime,
    }

    // Prepare languages JSON
    const languagesJson = {
      languages: body.languages || [],
      otherLanguage: body.otherLanguage || '',
    }

    // Parse resume URL to get filename and metadata
    const resumePath = body.resumeUrl
    const resumeFileName = body.resumeFileName || resumePath?.split('/').pop() || null
    const resumeMimeType = body.resumeMimeType || 'application/pdf'
    const resumeSize = body.resumeSize || null

    // Create RBT profile
    const rbtProfile = await prisma.rBTProfile.create({
      data: {
        userId: userRecord.id,
        firstName: body.firstName,
        lastName: body.lastName,
        phoneNumber: body.phoneNumber,
        email: body.email,
        locationCity: body.city || null,
        locationState: body.state || null,
        zipCode: body.zipCode,
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2 || null,
        gender: null, // Not collected in public application
        ethnicity: body.ethnicity ? (body.ethnicity as any) : null,
        fortyHourCourseCompleted: body.fortyHourCourseCompleted === 'true',
        status: 'NEW',
        source: 'PUBLIC_APPLICATION',
        submittedAt: new Date(),
        resumeUrl: resumePath,
        resumeFileName: resumeFileName,
        resumeMimeType: resumeMimeType,
        resumeSize: resumeSize,
        availabilityJson: availabilityJson,
        languagesJson: languagesJson,
        experienceYears: body.experienceYears ? parseInt(body.experienceYears) : null,
        transportation: body.transportation === 'true' ? true : body.transportation === 'false' ? false : null,
        preferredHoursRange: body.preferredHoursRange || null,
        notes: body.notes || null,
      },
    })

    // Mark draft as submitted if token exists
    if (body.draftToken) {
      try {
        await prisma.candidateApplicationDraft.updateMany({
          where: { token: body.draftToken },
          data: { status: 'SUBMITTED' },
        })
      } catch (error) {
        // Draft might not exist, ignore error
        console.log('Draft not found or already submitted:', error)
      }
    }

    // Send email notifications (non-blocking)
    try {
      // Send internal notification to admin
      const internalEmail = generateApplicationSubmissionInternalEmail({
        firstName: rbtProfile.firstName,
        lastName: rbtProfile.lastName,
        email: rbtProfile.email,
        id: rbtProfile.id,
        resumeUrl: rbtProfile.resumeUrl,
      })

      if (resend) {
        resend.emails.send({
          from: emailFrom,
          to: adminEmail,
          subject: internalEmail.subject,
          html: internalEmail.html,
        }).catch((error) => {
          console.error('Error sending internal notification email:', error)
        })
      } else {
        console.log('⚠️ [DEV MODE] Internal notification email would be sent to:', adminEmail)
        console.log('Subject:', internalEmail.subject)
      }

      // Send confirmation email to applicant
      if (rbtProfile.email) {
        const confirmationEmail = generateApplicationSubmissionConfirmationEmail({
          firstName: rbtProfile.firstName,
          lastName: rbtProfile.lastName,
          email: rbtProfile.email,
          id: rbtProfile.id,
        })

        if (resend) {
          resend.emails.send({
            from: emailFrom,
            to: rbtProfile.email,
            subject: confirmationEmail.subject,
            html: confirmationEmail.html,
          }).catch((error) => {
            console.error('Error sending confirmation email:', error)
          })
        } else {
          console.log('⚠️ [DEV MODE] Confirmation email would be sent to:', rbtProfile.email)
          console.log('Subject:', confirmationEmail.subject)
        }
      }
    } catch (error) {
      console.error('Error sending notification emails:', error)
      // Don't fail the request if emails fail
    }

    return NextResponse.json({
      success: true,
      id: rbtProfile.id,
    })
  } catch (error: any) {
    console.error('Error submitting application:', error)
    
    // Handle duplicate email/phone errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An application with this email or phone number already exists.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit application. Please try again.' },
      { status: 500 }
    )
  }
}
