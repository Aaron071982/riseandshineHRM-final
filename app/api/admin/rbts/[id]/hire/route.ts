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

    if (!rbtProfile.email) {
      return NextResponse.json(
        { error: 'RBT profile must have an email address to be hired' },
        { status: 400 }
      )
    }

    // Ensure User exists and has correct email, then update role to RBT
    // This is critical: the User.email must match RBTProfile.email for login to work
    try {
      // First, check if email is already in use by a different user
      if (rbtProfile.email) {
        const existingUserWithEmail = await prisma.user.findUnique({
          where: { email: rbtProfile.email },
        })
        
        if (existingUserWithEmail && existingUserWithEmail.id !== rbtProfile.userId) {
          console.error(`Email ${rbtProfile.email} is already associated with user ${existingUserWithEmail.id}`)
          return NextResponse.json(
            { error: 'Email is already associated with another account' },
            { status: 400 }
          )
        }
      }

      // Update user with all required fields
      const updatedUser = await prisma.user.update({
        where: { id: rbtProfile.userId },
        data: { 
          role: 'RBT',
          email: rbtProfile.email || undefined, // Sync email - this is required for login
          isActive: true, // Ensure user is active
        },
      })
      console.log(`✅ Updated user ${updatedUser.id} to RBT role with email ${rbtProfile.email || 'N/A'}`)
    } catch (error: any) {
      console.error('❌ Error updating user during hire:', error)
      
      // If email conflict, try updating without email first
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        console.log('⚠️ Email conflict detected, updating role and isActive only...')
        try {
          const updatedUser = await prisma.user.update({
            where: { id: rbtProfile.userId },
            data: { 
              role: 'RBT',
              isActive: true,
            },
          })
          console.log(`✅ Updated user ${updatedUser.id} to RBT role (skipped email update due to conflict)`)
        } catch (secondError: any) {
          console.error('❌ Failed to update user even without email:', secondError)
          return NextResponse.json(
            { error: 'Failed to update user account. Please contact support.' },
            { status: 500 }
          )
        }
      } else {
        console.error('❌ Failed to update user role during hire:', error)
        return NextResponse.json(
          { error: 'Failed to update user account. Please try again or contact support.' },
          { status: 500 }
        )
      }
    }

    // Update RBT profile status to HIRED
    await prisma.rBTProfile.update({
      where: { id },
      data: { status: 'HIRED' },
    })

    // ALWAYS ensure onboarding tasks exist (create if missing, skip if already exist)
    const existingTasks = await prisma.onboardingTask.findMany({
      where: { rbtProfileId: rbtProfile.id },
    })

    if (existingTasks.length === 0) {
      console.log(`Creating onboarding tasks for RBT ${rbtProfile.id}...`)

      // Check if 40-hour course is completed (explicitly handle null/undefined as false)
      const needsFortyHourCourse = !(rbtProfile.fortyHourCourseCompleted === true)
      console.log(`RBT ${rbtProfile.id} - fortyHourCourseCompleted: ${rbtProfile.fortyHourCourseCompleted}, needsFortyHourCourse: ${needsFortyHourCourse}`)

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
          documentDownloadUrl: '/api/rbt/onboarding-package/download', // Downloads the onboarding documents folder as a zip
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
                documentDownloadUrl: task.documentDownloadUrl || null,
                sortOrder: task.sortOrder,
              },
            })
          )
        )
        console.log(`✅ Created ${onboardingTasks.length} onboarding tasks for RBT ${rbtProfile.id}`)
      } catch (taskError: any) {
        console.error(`❌ Error creating onboarding tasks:`, taskError)
        // Don't fail the entire hire process if tasks fail - log error but continue
        // Tasks can be created manually if needed
      }
    } else {
      // Tasks already exist - check if they match expected structure
      const needsFortyHourCourse = !(rbtProfile.fortyHourCourseCompleted === true)
      const expectedTaskCount = needsFortyHourCourse ? 9 : 8
      const hasFortyHourCourseTask = existingTasks.some(t => t.taskType === 'FORTY_HOUR_COURSE_CERTIFICATE')
      console.log(`RBT ${rbtProfile.id} - Existing tasks: ${existingTasks.length}, Expected: ${expectedTaskCount}, Has 40-hour task: ${hasFortyHourCourseTask}, Needs course: ${needsFortyHourCourse}, fortyHourCourseCompleted value: ${rbtProfile.fortyHourCourseCompleted}`)
      
      // If task count is wrong OR 40-hour course task is missing when it should exist, recreate tasks
      if (existingTasks.length !== expectedTaskCount || (needsFortyHourCourse && !hasFortyHourCourseTask)) {
        console.log(`⚠️ Found ${existingTasks.length} tasks (expected ${expectedTaskCount}) for RBT ${rbtProfile.id}. Missing 40-hour course task: ${needsFortyHourCourse && !hasFortyHourCourseTask}. Recreating tasks...`)
        
        // Delete existing tasks
        await prisma.onboardingTask.deleteMany({
          where: { rbtProfileId: rbtProfile.id },
        })
        
        // Recreate tasks with correct structure
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
                  documentDownloadUrl: task.documentDownloadUrl || null,
                  sortOrder: task.sortOrder,
                },
              })
            )
          )
          console.log(`✅ Recreated ${onboardingTasks.length} onboarding tasks for RBT ${rbtProfile.id}`)
        } catch (taskError: any) {
          console.error(`❌ Error recreating onboarding tasks:`, taskError)
        }
      } else {
        console.log(`✅ Onboarding tasks already exist for RBT ${rbtProfile.id} (${existingTasks.length} tasks)`)
      }
    }

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

