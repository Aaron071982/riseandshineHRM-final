import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

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
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    // Check if 40-hour course is completed (explicitly handle null/undefined as false)
    const needsFortyHourCourse = !(rbtProfile.fortyHourCourseCompleted === true)
    console.log(`🔧 Fixing onboarding tasks for RBT ${rbtProfile.id} - fortyHourCourseCompleted: ${rbtProfile.fortyHourCourseCompleted}, needsFortyHourCourse: ${needsFortyHourCourse}`)

    // Delete all existing tasks
    await prisma.onboardingTask.deleteMany({
      where: { rbtProfileId: rbtProfile.id },
    })

    // Create tasks with correct structure
    const onboardingTasks = [
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'HIPAA Security Overview',
        description: 'Review the HIPAA Security Rule overview from HHS',
        documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        sortOrder: 1,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'HIPAA Privacy Overview',
        description: 'Review the HIPAA Privacy Rule overview from HHS',
        documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html',
        sortOrder: 2,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'HIPAA Patient Security',
        description: 'Review HIPAA patient safety guidelines from HHS',
        documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/patient-safety/index.html',
        sortOrder: 3,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'HIPAA Basics PDF',
        description: 'Download and review the HIPAA Basics for Providers document from CMS',
        documentDownloadUrl: 'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf',
        sortOrder: 4,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'HIPAA IT Security Guide',
        description: 'Review the Guide to Privacy and Security of Electronic Health Information',
        documentDownloadUrl: 'https://www.healthit.gov/topic/health-it-resources/guide-privacy-security-electronic-health-information',
        sortOrder: 5,
      },
      {
        taskType: 'DOWNLOAD_DOC',
        title: 'Download Onboarding Documents Folder',
        description: 'Download the complete onboarding documents folder. You will need to fill out all documents and re-upload them as a folder after logging in.',
        documentDownloadUrl: '/api/rbt/onboarding-package/download',
        sortOrder: needsFortyHourCourse ? 7 : 6,
      },
      ...(needsFortyHourCourse ? [{
        taskType: 'FORTY_HOUR_COURSE_CERTIFICATE',
        title: 'Complete 40-Hour RBT Course & Upload Certificate',
        description: 'Complete the 40-hour RBT training course and upload your certificate of completion',
        documentDownloadUrl: 'https://courses.autismpartnershipfoundation.org/offers/it285gs6/checkout',
        sortOrder: 6,
      }] : []),
      {
        taskType: 'SIGNATURE',
        title: 'Digital Signature Confirmation',
        description: 'Sign to confirm you have read and understood all HIPAA documents and training materials',
        sortOrder: needsFortyHourCourse ? 8 : 7,
      },
      {
        taskType: 'PACKAGE_UPLOAD',
        title: 'Upload Completed Onboarding Package',
        description: 'Upload your completed onboarding package with all signed documents. This will be sent to the administrator for review.',
        sortOrder: needsFortyHourCourse ? 9 : 8,
      },
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

    console.log(`✅ Recreated ${onboardingTasks.length} onboarding tasks for RBT ${rbtProfile.id}`)

    return NextResponse.json({
      success: true,
      message: `Successfully recreated ${onboardingTasks.length} onboarding tasks`,
      taskCount: onboardingTasks.length,
    })
  } catch (error: any) {
    console.error('Error fixing onboarding tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fix onboarding tasks: ' + error.message },
      { status: 500 }
    )
  }
}

