import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { sendEmail, generateManualHireOnboardingEmail, EmailTemplateType } from '@/lib/email'

/**
 * POST /api/admin/rbts/mark-hired-by-name
 * Body: { firstName: string, lastName: string }
 * Marks the RBT profile(s) matching that name (case-insensitive) as HIRED,
 * ensures onboarding tasks exist, and sends the "You're Hired!" onboarding email.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : ''
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'firstName and lastName are required' }, { status: 400 })
    }

    const profiles = await prisma.rBTProfile.findMany({
      where: {
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
      },
      include: { user: true },
    })

    if (profiles.length === 0) {
      return NextResponse.json(
        { error: `No RBT profile found with firstName "${firstName}" and lastName "${lastName}"` },
        { status: 404 }
      )
    }

    const results: { id: string; name: string; emailSent: boolean }[] = []

    for (const profile of profiles) {
      await prisma.rBTProfile.update({
        where: { id: profile.id },
        data: { status: 'HIRED' },
      })

      // Ensure user role is RBT
      await prisma.user.update({
        where: { id: profile.userId },
        data: { role: 'RBT', isActive: true },
      })

      const existingTasks = await prisma.onboardingTask.count({
        where: { rbtProfileId: profile.id },
      })
      if (existingTasks === 0) {
        const needsFortyHourCourse = !(profile.fortyHourCourseCompleted === true)
        const onboardingTasks = [
          { taskType: 'DOWNLOAD_DOC', title: 'HIPAA Security Overview', description: 'Review the HIPAA Security Rule overview from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html', sortOrder: 1 },
          { taskType: 'DOWNLOAD_DOC', title: 'HIPAA Privacy Overview', description: 'Review the HIPAA Privacy Rule overview from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html', sortOrder: 2 },
          { taskType: 'DOWNLOAD_DOC', title: 'HIPAA Patient Security', description: 'Review HIPAA patient safety guidelines from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/patient-safety/index.html', sortOrder: 3 },
          { taskType: 'DOWNLOAD_DOC', title: 'HIPAA Basics PDF', description: 'Download and review the HIPAA Basics for Providers document from CMS', documentDownloadUrl: 'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf', sortOrder: 4 },
          { taskType: 'DOWNLOAD_DOC', title: 'HIPAA IT Security Guide', description: 'Review the Guide to Privacy and Security of Electronic Health Information', documentDownloadUrl: 'https://www.healthit.gov/topic/health-it-resources/guide-privacy-security-electronic-health-information', sortOrder: 5 },
          ...(needsFortyHourCourse ? [{ taskType: 'FORTY_HOUR_COURSE_CERTIFICATE', title: 'Complete 40-Hour RBT Course & Upload Certificate', description: 'Complete the 40-hour RBT training course and upload your certificate of completion', documentDownloadUrl: 'https://courses.autismpartnershipfoundation.org/offers/it285gs6/checkout', sortOrder: 6 }] : []),
          { taskType: 'SIGNATURE', title: 'Digital Signature Confirmation', description: 'Sign to confirm you have read and understood all HIPAA documents and training materials', documentDownloadUrl: null as string | null, sortOrder: needsFortyHourCourse ? 7 : 6 },
        ]
        await Promise.all(
          onboardingTasks.map((task) =>
            prisma.onboardingTask.create({
              data: {
                rbtProfileId: profile.id,
                taskType: task.taskType as any,
                title: task.title,
                description: task.description,
                documentDownloadUrl: task.documentDownloadUrl,
                sortOrder: task.sortOrder,
              },
            })
          )
        )
      }

      let emailSent = false
      if (profile.email) {
        const emailContent = generateManualHireOnboardingEmail(
          { firstName: profile.firstName, lastName: profile.lastName, email: profile.email },
          profile.fortyHourCourseCompleted === true
        )
        await sendEmail({
          to: profile.email,
          subject: emailContent.subject,
          html: emailContent.html,
          templateType: EmailTemplateType.OFFER,
          rbtProfileId: profile.id,
        })
        emailSent = true
      }

      results.push({
        id: profile.id,
        name: `${profile.firstName} ${profile.lastName}`,
        emailSent,
      })
    }

    return NextResponse.json({
      ok: true,
      updated: profiles.length,
      results,
    })
  } catch (e) {
    console.error('mark-hired-by-name:', e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
