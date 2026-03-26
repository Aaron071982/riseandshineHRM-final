import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ScheduleSetupWrapper from './ScheduleSetupWrapper'
import RBTDashboardHome from '@/components/rbt/RBTDashboardHome'
import { PrismaClientKnownRequestError, PrismaClientInitializationError } from '@prisma/client/runtime/library'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper function to safely log errors without exposing secrets
function logError(context: string, error: unknown) {
  const errorInfo: any = {
    context,
    timestamp: new Date().toISOString(),
    path: '/rbt/dashboard',
  }

  if (error instanceof Error) {
    errorInfo.type = error.constructor.name
    errorInfo.message = error.message
    
    // Include stack trace in development, but not in production logs (too verbose)
    if (process.env.NODE_ENV === 'development') {
      errorInfo.stack = error.stack
    }
    
    // Check for Prisma errors
    if (error instanceof PrismaClientKnownRequestError) {
      errorInfo.prismaCode = error.code
      errorInfo.prismaMeta = error.meta
      errorInfo.category = 'prisma_known_error'
    } else if (error instanceof PrismaClientInitializationError) {
      errorInfo.errorCode = (error as any).errorCode
      errorInfo.category = 'prisma_initialization_error'
    }
  } else {
    errorInfo.rawError = String(error)
    errorInfo.category = 'unknown_error'
  }

  // Log to console with structured format for Vercel logs
  console.error(`[RBT Dashboard Error] ${context}:`, JSON.stringify(errorInfo, null, 2))
}

// Helper to check environment variables (booleans only, no values)
function checkEnvironmentVariables() {
  const envCheck = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV || 'development',
    // Log other important env vars presence (not values)
    hasResendApiKey: !!process.env.RESEND_API_KEY,
    hasEmailFrom: !!process.env.EMAIL_FROM,
    timestamp: new Date().toISOString(),
  }
  
  // Log env check in production to help debug
  if (process.env.NODE_ENV === 'production') {
    console.log('[RBT Dashboard] Environment check:', JSON.stringify(envCheck))
  }
  
  return envCheck
}

export default async function RBTDashboardPage() {
  try {
    return await RBTDashboardPageInner()
  } catch (error) {
    logError('Unexpected error in RBT dashboard', error)
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-2">Something went wrong</h1>
          <p className="text-red-700">
            We couldn’t load your dashboard. Please try again or contact support.
          </p>
        </div>
      </div>
    )
  }
}

async function RBTDashboardPageInner() {
  // Check environment variables first
  const envCheck = checkEnvironmentVariables()
  if (!envCheck.hasDatabaseUrl) {
    logError('Environment validation failed', new Error('DATABASE_URL is not set'))
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-2">Configuration Error</h1>
          <p className="text-red-700">
            Database configuration is missing. Please contact support.
          </p>
          <p className="text-sm text-red-600 mt-2">
            Environment: {envCheck.nodeEnv}
          </p>
        </div>
      </div>
    )
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  // Validate session with error handling
  let user
  try {
    user = await validateSession(sessionToken)
  } catch (error) {
    logError('Session validation failed', error)
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-2">Authentication Error</h1>
          <p className="text-red-700">
            Unable to verify your session. Please try logging in again.
          </p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
    redirect('/')
  }

  // Check if onboarding is complete with error handling
  let onboardingTasks: Awaited<ReturnType<typeof prisma.onboardingTask.findMany>> = []
  try {
    onboardingTasks = await prisma.onboardingTask.findMany({
      where: {
        rbtProfileId: user.rbtProfileId,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  } catch (error) {
    logError('Failed to fetch onboarding tasks', error)
    try {
      const raw = await prisma.$queryRaw<
        Array<{ id: string; taskType: string; title: string | null; description: string | null; isCompleted: boolean; sortOrder: number; documentDownloadUrl: string | null }>
      >`
        SELECT id, "taskType", title, description, "isCompleted", "sortOrder", "documentDownloadUrl"
        FROM onboarding_tasks
        WHERE "rbtProfileId" = ${user.rbtProfileId}
        ORDER BY "sortOrder" ASC
      `
      onboardingTasks = raw.map((r) => ({
        id: r.id,
        rbtProfileId: user.rbtProfileId!,
        taskType: r.taskType as any,
        title: r.title ?? '',
        description: r.description,
        isCompleted: r.isCompleted,
        sortOrder: r.sortOrder,
        documentDownloadUrl: r.documentDownloadUrl,
        uploadUrl: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    } catch (rawErr) {
      logError('Raw fallback for onboarding tasks failed', rawErr)
      return (
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)]">
            <h1 className="text-xl font-bold text-amber-800 dark:text-[var(--status-warning-text)] mb-2">Data loading issue</h1>
            <p className="text-amber-700 dark:text-[var(--status-warning-text)]">
              Your data is still in the database. Ask your admin to run the migration in Supabase (prisma/supabase-migrations.sql, sections 4 and 5), then refresh.
            </p>
          </div>
        </div>
      )
    }
  }

  // Canonical onboarding task list (must match hire route and manual-add): 5 HIPAA + optional 40-hour + signature = 6 or 7 tasks
  const buildCanonicalOnboardingTasks = (needsFortyHourCourse: boolean) => [
    { taskType: 'DOWNLOAD_DOC' as const, title: 'HIPAA Security Overview', description: 'Review the HIPAA Security Rule overview from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html', sortOrder: 1 },
    { taskType: 'DOWNLOAD_DOC' as const, title: 'HIPAA Privacy Overview', description: 'Review the HIPAA Privacy Rule overview from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html', sortOrder: 2 },
    { taskType: 'DOWNLOAD_DOC' as const, title: 'HIPAA Patient Security', description: 'Review HIPAA patient safety guidelines from HHS', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/patient-safety/index.html', sortOrder: 3 },
    { taskType: 'DOWNLOAD_DOC' as const, title: 'HIPAA Basics PDF', description: 'Download and review the HIPAA Basics for Providers document from CMS', documentDownloadUrl: 'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf', sortOrder: 4 },
    { taskType: 'DOWNLOAD_DOC' as const, title: 'HIPAA IT Security Guide', description: 'Review the Guide to Privacy and Security of Electronic Health Information', documentDownloadUrl: 'https://www.healthit.gov/topic/health-it-resources/guide-privacy-security-electronic-health-information', sortOrder: 5 },
    ...(needsFortyHourCourse ? [{ taskType: 'FORTY_HOUR_COURSE_CERTIFICATE' as const, title: 'Complete 40-Hour RBT Course & Upload Certificate', description: 'Complete the 40-hour RBT training course and upload your certificate of completion', documentDownloadUrl: 'https://courses.autismpartnershipfoundation.org/offers/it285gs6/checkout', sortOrder: 6 }] : []),
    { taskType: 'SIGNATURE' as const, title: 'Digital Signature Confirmation', description: 'Sign to confirm you have read and understood all HIPAA documents and training materials', documentDownloadUrl: null as string | null, sortOrder: needsFortyHourCourse ? 7 : 6 },
  ]

  const createCanonicalTasksForRbt = async (rbtProfileId: string, needsFortyHourCourse: boolean) => {
    const tasks = buildCanonicalOnboardingTasks(needsFortyHourCourse)
    await Promise.all(
      tasks.map((task) =>
        prisma.onboardingTask.create({
          data: {
            rbtProfileId,
            taskType: task.taskType,
            title: task.title,
            description: task.description,
            documentDownloadUrl: task.documentDownloadUrl,
            sortOrder: task.sortOrder,
          },
        })
      )
    )
  }

  // If no tasks exist but RBT is hired, create canonical tasks (safety check). Also repair wrong task sets (e.g. old 4-task list or missing 40-hour).
  const rbtProfileForTasks = onboardingTasks.length > 0 || onboardingTasks.length === 0
    ? await prisma.rBTProfile.findUnique({ where: { id: user.rbtProfileId }, select: { status: true, fortyHourCourseCompleted: true } })
    : null

  const needsFortyHourCourse = rbtProfileForTasks ? !(rbtProfileForTasks.fortyHourCourseCompleted === true) : true
  const expectedTaskCount = needsFortyHourCourse ? 7 : 6
  const hasFortyHourTask = onboardingTasks.some((t) => t.taskType === 'FORTY_HOUR_COURSE_CERTIFICATE')
  const needsRepair =
    rbtProfileForTasks?.status === 'HIRED' &&
    (onboardingTasks.length === 0 || onboardingTasks.length !== expectedTaskCount || (needsFortyHourCourse && !hasFortyHourTask))

  if (needsRepair) {
    try {
      if (onboardingTasks.length > 0) {
        console.log(`[RBT Dashboard] Repairing onboarding tasks for RBT ${user.rbtProfileId}: had ${onboardingTasks.length}, expected ${expectedTaskCount}, needsFortyHour: ${needsFortyHourCourse}`)
        await prisma.onboardingTask.deleteMany({ where: { rbtProfileId: user.rbtProfileId! } })
      } else {
        console.log(`[RBT Dashboard] RBT ${user.rbtProfileId} is HIRED but has no tasks. Creating canonical tasks (40-hour: ${needsFortyHourCourse})...`)
      }
      await createCanonicalTasksForRbt(user.rbtProfileId!, needsFortyHourCourse)
      onboardingTasks = await prisma.onboardingTask.findMany({
        where: { rbtProfileId: user.rbtProfileId },
        orderBy: { sortOrder: 'asc' },
      })
    } catch (error) {
      logError('Error creating/repairing onboarding tasks', error)
      if (onboardingTasks.length === 0) {
        return (
          <div className="container mx-auto p-6 max-w-4xl">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h1 className="text-xl font-bold text-yellow-800 mb-2">Onboarding Setup Required</h1>
              <p className="text-yellow-700">
                Your onboarding tasks are being prepared. Please refresh the page in a moment.
              </p>
              <p className="text-sm text-yellow-600 mt-2">
                If this message persists, please contact support.
              </p>
            </div>
          </div>
        )
      }
    }
  }

  // Load profile, documents, completions, shifts, time entries for unified dashboard
  let rbtProfile: { firstName: string; scheduleCompleted?: boolean } | null = null
  let onboardingDocuments: Awaited<ReturnType<typeof prisma.onboardingDocument.findMany>> = []
  let completions: Awaited<ReturnType<typeof prisma.onboardingCompletion.findMany>> = []
  let todayShifts: Awaited<ReturnType<typeof prisma.shift.findMany>> = []
  let upcomingShifts: Awaited<ReturnType<typeof prisma.shift.findMany>> = []
  let timeEntries: Awaited<ReturnType<typeof prisma.timeEntry.findMany>> = []
  let activeSessionClockIn: Date | null = null

  try {
    const [profileResult, docsResult, completionsResult, todayResult, upcomingResult, timeResult] = await Promise.all([
      prisma.rBTProfile.findUnique({
        where: { id: user.rbtProfileId },
        select: { firstName: true, scheduleCompleted: true },
      }),
      prisma.onboardingDocument.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.onboardingCompletion.findMany({
        where: { rbtProfileId: user.rbtProfileId },
        include: { document: true },
      }),
      prisma.shift.findMany({
        where: {
          rbtProfileId: user.rbtProfileId,
          startTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: { not: 'CANCELED' },
        },
        orderBy: { startTime: 'asc' },
      }),
      prisma.shift.findMany({
        where: {
          rbtProfileId: user.rbtProfileId,
          startTime: { gt: new Date(new Date().setHours(23, 59, 59, 999)) },
          status: { not: 'CANCELED' },
        },
        orderBy: { startTime: 'asc' },
      }),
      prisma.timeEntry.findMany({
        where: {
          rbtProfileId: user.rbtProfileId,
          clockInTime: { gte: new Date(new Date().setDate(new Date().getDate() - 31)) },
        },
        orderBy: { clockInTime: 'desc' },
      }),
    ])
    rbtProfile = profileResult
    onboardingDocuments = docsResult
    completions = completionsResult
    todayShifts = todayResult
    upcomingShifts = upcomingResult
    timeEntries = timeResult
    activeSessionClockIn = timeResult.find((t) => t.clockOutTime == null)?.clockInTime ?? null
  } catch (err) {
    logError('Failed to load dashboard data', err)
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-2">Error Loading Dashboard</h1>
          <p className="text-red-700">Unable to load your dashboard. Please try again.</p>
        </div>
      </div>
    )
  }

  if (!rbtProfile) {
    redirect('/')
  }

  // Show schedule setup if not completed
  if (!rbtProfile.scheduleCompleted) {
    try {
      return <ScheduleSetupWrapper rbtProfileId={user.rbtProfileId} />
    } catch (error) {
      logError('Failed to render ScheduleSetupWrapper', error)
      return (
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-bold text-red-800 mb-2">Error Loading Schedule Setup</h1>
            <p className="text-red-700">Unable to load the schedule setup. Please try refreshing the page.</p>
          </div>
        </div>
      )
    }
  }

  // Compute onboarding progress (tasks + documents)
  const totalSteps = onboardingTasks.length + onboardingDocuments.length
  const completedTaskCount = onboardingTasks.filter((t) => t.isCompleted).length
  const completedDocCount = completions.filter((c) => c.status === 'COMPLETED').length
  const completedSteps = completedTaskCount + completedDocCount
  const onboardingPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 100

  const remainingTasks = [
    ...onboardingTasks.filter((t) => !t.isCompleted).map((t) => ({ id: t.id, title: t.title, isCompleted: false })),
    ...onboardingDocuments
      .filter((d) => completions.find((c) => c.documentId === d.id)?.status !== 'COMPLETED')
      .map((d) => ({ id: d.id, title: d.title, isCompleted: false })),
  ]
  const completedTasks = [
    ...onboardingTasks.filter((t) => t.isCompleted).map((t) => ({ id: t.id, title: t.title, isCompleted: true })),
    ...completions
      .filter((c) => c.status === 'COMPLETED')
      .map((c) => ({
        id: c.documentId,
        title: (c as any).document?.title ?? 'Document',
        isCompleted: true,
      })),
  ]

  // Fillable PDFs: downloaded but not yet uploaded (for reminder banner)
  const pendingUploadTitles = completions
    .filter(
      (c) =>
        c.downloadedAt != null &&
        !c.signedPdfUrl &&
        c.status !== 'COMPLETED' &&
        (c as any).document?.type === 'FILLABLE_PDF'
    )
    .map((c) => (c as any).document?.title ?? '')

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const hoursThisWeek = timeEntries
    .filter((e) => e.clockInTime >= weekStart && e.totalHours)
    .reduce((sum, e) => sum + (e.totalHours ?? 0), 0)
  const hoursThisMonth = timeEntries
    .filter((e) => e.clockInTime >= monthStart && e.totalHours)
    .reduce((sum, e) => sum + (e.totalHours ?? 0), 0)

  try {
    return (
      <RBTDashboardHome
        firstName={rbtProfile.firstName}
        onboardingPercent={onboardingPercent}
        totalSteps={totalSteps}
        completedSteps={completedSteps}
        remainingTasks={remainingTasks}
        completedTasks={completedTasks}
        todayShifts={todayShifts}
        upcomingShifts={upcomingShifts}
        hoursThisWeek={hoursThisWeek}
        hoursThisMonth={hoursThisMonth}
        upcomingShiftsCount={upcomingShifts.length}
        pendingUploadTitles={pendingUploadTitles}
        activeSessionClockIn={activeSessionClockIn}
      />
    )
  } catch (error) {
    logError('Failed to render RBTDashboardHome', error)
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-2">Error Loading Dashboard</h1>
          <p className="text-red-700">Unable to load your dashboard. Please try refreshing the page.</p>
        </div>
      </div>
    )
  }
}

