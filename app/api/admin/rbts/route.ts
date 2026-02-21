import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { sendEmail, generateManualHireOnboardingEmail, EmailTemplateType } from '@/lib/email'

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

    const formData = await request.formData()

    // Extract form fields
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      phoneNumber: formData.get('phoneNumber') as string,
      email: (formData.get('email') as string) || null,
      locationCity: (formData.get('locationCity') as string) || null,
      locationState: (formData.get('locationState') as string) || null,
      zipCode: formData.get('zipCode') as string,
      addressLine1: formData.get('addressLine1') as string,
      addressLine2: (formData.get('addressLine2') as string) || null,
      preferredServiceArea: (formData.get('preferredServiceArea') as string) || null,
      notes: (formData.get('notes') as string) || null,
      gender: (formData.get('gender') as string) || null,
      ethnicity: (formData.get('ethnicity') as string) || null,
      fortyHourCourseCompleted: formData.get('fortyHourCourseCompleted') === 'true',
      status: (formData.get('status') as string) || 'NEW',
    }

    // Validate required fields
    if (!data.addressLine1 || !data.zipCode) {
      return NextResponse.json(
        { error: 'Address Line 1 and Zip Code are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['NEW', 'REACH_OUT', 'REACH_OUT_EMAIL_SENT', 'TO_INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'STALLED', 'REJECTED'] as const
    const status = validStatuses.includes(data.status as any) ? (data.status as (typeof validStatuses)[number]) : 'NEW'

    // Create user first
    const userRecord = await prisma.user.create({
      data: {
        phoneNumber: data.phoneNumber,
        email: data.email || null,
        name: `${data.firstName} ${data.lastName}`,
        role: status === 'HIRED' ? 'RBT' : 'CANDIDATE',
        isActive: true,
      },
    })

    // Create RBT profile
    const rbtProfile = await prisma.rBTProfile.create({
      data: {
        userId: userRecord.id,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        email: data.email || null,
        locationCity: data.locationCity || null,
        locationState: data.locationState || null,
        zipCode: data.zipCode || null,
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        preferredServiceArea: data.preferredServiceArea || null,
        notes: data.notes || null,
        gender: data.gender || null,
        ethnicity: data.ethnicity ? (data.ethnicity as any) : null,
        fortyHourCourseCompleted: data.fortyHourCourseCompleted,
        status,
      },
    })

    // Handle documents if provided
    const files = formData.getAll('documents') as File[]
    const documentTypes = formData.getAll('documentTypes') as string[]

    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const documentType = documentTypes[i] || 'OTHER'

        // Convert file to base64
        const fileBuffer = Buffer.from(await file.arrayBuffer())
        const fileBase64 = fileBuffer.toString('base64')
        const fileMimeType = file.type || 'application/octet-stream'

        await prisma.rBTDocument.create({
          data: {
            rbtProfileId: rbtProfile.id,
            fileName: file.name,
            fileType: fileMimeType,
            fileData: fileBase64,
            documentType: documentType,
          },
        })
      }
    }

    // When manually hired: create onboarding tasks (including 40-hour course if not completed) and send onboarding email
    if (status === 'HIRED') {
      const needsFortyHourCourse = !data.fortyHourCourseCompleted
      const onboardingTasks = [
        { taskType: 'DOWNLOAD_DOC', title: 'HIPAA Security Overview', description: 'Review the HIPAA Security Rule overview from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html', sortOrder: 1 },
        { taskType: 'DOWNLOAD_DOC', title: 'HIPAA Privacy Overview', description: 'Review the HIPAA Privacy Rule overview from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html', sortOrder: 2 },
        { taskType: 'DOWNLOAD_DOC', title: 'HIPAA Patient Security', description: 'Review HIPAA patient safety guidelines from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/patient-safety/index.html', sortOrder: 3 },
        { taskType: 'DOWNLOAD_DOC', title: 'HIPAA Basics PDF', description: 'Download and review the HIPAA Basics for Providers document from CMS', documentDownloadUrl: 'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf', sortOrder: 4 },
        { taskType: 'DOWNLOAD_DOC', title: 'HIPAA IT Security Guide', description: 'Review the Guide to Privacy and Security of Electronic Health Information', documentDownloadUrl: 'https://www.healthit.gov/topic/health-it-resources/guide-privacy-security-electronic-health-information', sortOrder: 5 },
        ...(needsFortyHourCourse ? [{ taskType: 'FORTY_HOUR_COURSE_CERTIFICATE', title: 'Complete 40-Hour RBT Course & Upload Certificate', description: 'Complete the 40-hour RBT training course and upload your certificate of completion', documentDownloadUrl: 'https://courses.autismpartnershipfoundation.org/offers/it285gs6/checkout', sortOrder: 6 }] : []),
        { taskType: 'SIGNATURE', title: 'Digital Signature Confirmation', description: 'Sign to confirm you have read and understood all HIPAA documents and training materials', documentDownloadUrl: null as string | null, sortOrder: needsFortyHourCourse ? 7 : 6 },
      ]
      try {
        await Promise.all(
          onboardingTasks.map((task) =>
            prisma.onboardingTask.create({
              data: {
                rbtProfileId: rbtProfile.id,
                taskType: task.taskType as any,
                title: task.title,
                description: task.description,
                documentDownloadUrl: task.documentDownloadUrl,
                sortOrder: task.sortOrder,
              },
            })
          )
        )
      } catch (taskError) {
        console.error('Failed to create onboarding tasks for manual hire:', taskError)
      }

      if (rbtProfile.email) {
        const emailContent = generateManualHireOnboardingEmail(
          { firstName: rbtProfile.firstName, lastName: rbtProfile.lastName, email: rbtProfile.email },
          data.fortyHourCourseCompleted
        )
        await sendEmail({
          to: rbtProfile.email,
          subject: emailContent.subject,
          html: emailContent.html,
          templateType: EmailTemplateType.OFFER,
          rbtProfileId: rbtProfile.id,
        })
      }
    }

    // Track form submission
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'FORM_SUBMISSION',
          action: `Created RBT candidate: ${data.firstName} ${data.lastName}`,
          resourceType: 'RBTProfile',
          resourceId: rbtProfile.id,
          ipAddress,
          userAgent: request.headers.get('user-agent') || null,
          metadata: {
            email: data.email,
            status: data.status,
          },
        },
      })
    } catch (error) {
      console.error('Failed to track RBT creation:', error)
    }

    return NextResponse.json({ id: rbtProfile.id, success: true })
  } catch (error: any) {
    console.error('Error creating RBT:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create candidate' },
      { status: 500 }
    )
  }
}

