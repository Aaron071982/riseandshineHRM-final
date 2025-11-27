import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { sendEmail, generateOfferEmail, EmailTemplateType } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    // Update user role to RBT
    await prisma.user.update({
      where: { id: rbtProfile.userId },
      data: { role: 'RBT' },
    })

    // Update RBT profile status to HIRED
    await prisma.rBTProfile.update({
      where: { id },
      data: { status: 'HIRED' },
    })

    // Create onboarding tasks
    const onboardingTasks = [
      // Document tasks
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'Download HIPAA Agreement',
        description: 'Download and review the HIPAA Agreement document',
        documentDownloadUrl: '/documents/hipaa-agreement.pdf',
        sortOrder: 1,
      },
      {
        taskType: 'UPLOAD_SIGNED_DOC',
        title: 'Upload Signed HIPAA Agreement',
        description: 'Upload your signed HIPAA Agreement',
        sortOrder: 2,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'Download Confidentiality Agreement',
        description: 'Download and review the Confidentiality Agreement document',
        documentDownloadUrl: '/documents/confidentiality-agreement.pdf',
        sortOrder: 3,
      },
      {
        taskType: 'UPLOAD_SIGNED_DOC',
        title: 'Upload Signed Confidentiality Agreement',
        description: 'Upload your signed Confidentiality Agreement',
        sortOrder: 4,
      },
      // Training videos
      ...Array.from({ length: 8 }, (_, i) => ({
        taskType: 'VIDEO_COURSE',
        title: `HIPAA Training Video ${i + 1}`,
        description: `Complete HIPAA training video ${i + 1} of 8`,
        documentDownloadUrl: `https://example.com/hipaa-training-${i + 1}`,
        sortOrder: 5 + i,
      })),
    ]

    await Promise.all(
      onboardingTasks.map((task) =>
        prisma.onboardingTask.create({
          data: {
            rbtProfileId: rbtProfile.id,
            taskType: task.taskType as any,
            title: task.title,
            description: task.description,
            documentDownloadUrl: task.documentDownloadUrl || null,
            sortOrder: task.sortOrder,
          },
        })
      )
    )

    // Send welcome email
    if (rbtProfile.email) {
      const emailContent = generateOfferEmail(rbtProfile)
      await sendEmail({
        to: rbtProfile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        templateType: EmailTemplateType.OFFER,
        rbtProfileId: rbtProfile.id,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error hiring RBT:', error)
    return NextResponse.json(
      { error: 'Failed to hire RBT' },
      { status: 500 }
    )
  }
}

