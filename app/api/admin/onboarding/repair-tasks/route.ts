import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

/** Canonical onboarding task list: 5 HIPAA + optional 40-hour + signature = 6 or 7 tasks (must match hire route and RBT dashboard). */
function buildCanonicalTasks(needsFortyHourCourse: boolean) {
  return [
    {
      taskType: 'DOWNLOAD_DOC' as const,
      title: 'HIPAA Security Overview',
      description: 'Review the HIPAA Security Rule overview from HHS',
      documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
      sortOrder: 1,
    },
    {
      taskType: 'DOWNLOAD_DOC' as const,
      title: 'HIPAA Privacy Overview',
      description: 'Review the HIPAA Privacy Rule overview from HHS',
      documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html',
      sortOrder: 2,
    },
    {
      taskType: 'DOWNLOAD_DOC' as const,
      title: 'HIPAA Patient Security',
      description: 'Review HIPAA patient safety guidelines from HHS',
      documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/patient-safety/index.html',
      sortOrder: 3,
    },
    {
      taskType: 'DOWNLOAD_DOC' as const,
      title: 'HIPAA Basics PDF',
      description: 'Download and review the HIPAA Basics for Providers document from CMS',
      documentDownloadUrl: 'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf',
      sortOrder: 4,
    },
    {
      taskType: 'DOWNLOAD_DOC' as const,
      title: 'HIPAA IT Security Guide',
      description: 'Review the Guide to Privacy and Security of Electronic Health Information',
      documentDownloadUrl: 'https://www.healthit.gov/topic/health-it-resources/guide-privacy-security-electronic-health-information',
      sortOrder: 5,
    },
    ...(needsFortyHourCourse
      ? [
          {
            taskType: 'FORTY_HOUR_COURSE_CERTIFICATE' as const,
            title: 'Complete 40-Hour RBT Course & Upload Certificate',
            description: 'Complete the 40-hour RBT training course and upload your certificate of completion',
            documentDownloadUrl: 'https://courses.autismpartnershipfoundation.org/offers/it285gs6/checkout',
            sortOrder: 6,
          },
        ]
      : []),
    {
      taskType: 'SIGNATURE' as const,
      title: 'Digital Signature Confirmation',
      description: 'Sign to confirm you have read and understood all HIPAA documents and training materials',
      documentDownloadUrl: null as string | null,
      sortOrder: needsFortyHourCourse ? 7 : 6,
    },
  ]
}

export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const hired = await prisma.rBTProfile.findMany({
      where: { status: 'HIRED' },
      include: { onboardingTasks: true },
    })

    let repaired = 0
    for (const rbt of hired) {
      const needsFortyHourCourse = !(rbt.fortyHourCourseCompleted === true)
      const expectedCount = needsFortyHourCourse ? 7 : 6
      const hasFortyHourTask = rbt.onboardingTasks.some((t) => t.taskType === 'FORTY_HOUR_COURSE_CERTIFICATE')
      const needsRepair =
        rbt.onboardingTasks.length === 0 ||
        rbt.onboardingTasks.length !== expectedCount ||
        (needsFortyHourCourse && !hasFortyHourTask)

      if (!needsRepair) continue

      await prisma.onboardingTask.deleteMany({ where: { rbtProfileId: rbt.id } })
      const tasks = buildCanonicalTasks(needsFortyHourCourse)
      await Promise.all(
        tasks.map((task) =>
          prisma.onboardingTask.create({
            data: {
              rbtProfileId: rbt.id,
              taskType: task.taskType,
              title: task.title,
              description: task.description,
              documentDownloadUrl: task.documentDownloadUrl,
              sortOrder: task.sortOrder,
            },
          })
        )
      )
      repaired++
    }

    return NextResponse.json({
      success: true,
      message: `Repaired onboarding tasks for ${repaired} RBT(s). ${hired.length - repaired} already had correct tasks.`,
      repaired,
      total: hired.length,
    })
  } catch (error: unknown) {
    console.error('Repair onboarding tasks error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to repair tasks' },
      { status: 500 }
    )
  }
}
