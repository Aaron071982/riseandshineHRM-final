import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import OnboardingDashboard from '@/components/rbt/OnboardingDashboard'
import RBTMainDashboard from '@/components/rbt/RBTMainDashboard'
import ScheduleSetupWrapper from './ScheduleSetupWrapper'
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
  let onboardingTasks = []
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
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-2">Database Error</h1>
          <p className="text-red-700">
            Unable to load your onboarding tasks. Please try refreshing the page.
          </p>
          <p className="text-sm text-red-600 mt-2">
            If this problem persists, please contact support.
          </p>
        </div>
      </div>
    )
  }

  // If no tasks exist but RBT is hired, create them (safety check)
  if (onboardingTasks.length === 0) {
    // Auto-create tasks if missing (shouldn't happen, but safety net)
    try {
      const rbtProfile = await prisma.rBTProfile.findUnique({
        where: { id: user.rbtProfileId },
      })
      
      if (rbtProfile && rbtProfile.status === 'HIRED') {
        console.log(`[RBT Dashboard] RBT ${user.rbtProfileId} is HIRED but has no tasks. Creating them now...`)
        
        const tasks = [
          { taskType: 'DOWNLOAD_DOC', title: 'Download HIPAA Basics PDF', description: 'Download and review the HIPAA Basics for Providers document from CMS', documentDownloadUrl: 'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf', sortOrder: 1 },
          { taskType: 'DOWNLOAD_DOC', title: 'Review HHS HIPAA Portal', description: 'Review the HHS HIPAA for Professionals portal for comprehensive information', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/index.html', sortOrder: 2 },
          { taskType: 'DOWNLOAD_DOC', title: 'Download Confidentiality Agreement Templates', description: 'Download and review the HIPAA Confidentiality Agreement templates', documentDownloadUrl: 'https://www.sampleforms.com/hipaa-confidentiality-agreement-forms.html', sortOrder: 3 },
          { taskType: 'SIGNATURE', title: 'Digital Signature Confirmation', description: 'Sign to confirm you have read and understood all HIPAA documents and training materials', sortOrder: 4 },
        ]
        
        await Promise.all(
          tasks.map((task) =>
            prisma.onboardingTask.create({
              data: {
                rbtProfileId: user.rbtProfileId!,
                taskType: task.taskType as any,
                title: task.title,
                description: task.description,
                documentDownloadUrl: task.documentDownloadUrl || null,
                sortOrder: task.sortOrder,
              },
            })
          )
        )
        
        // Refetch tasks after creation
        const newTasks = await prisma.onboardingTask.findMany({
          where: { rbtProfileId: user.rbtProfileId },
          orderBy: { sortOrder: 'asc' },
        })
        
        const allCompleted = newTasks.length > 0 && newTasks.every((task) => task.isCompleted)
        if (!allCompleted) {
          return <OnboardingDashboard rbtProfileId={user.rbtProfileId} />
        }
      }
    } catch (error) {
      logError('Error auto-creating onboarding tasks', error)
      // Continue to show onboarding dashboard anyway - don't crash
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

  const allTasksCompleted = onboardingTasks.length > 0 && onboardingTasks.every((task) => task.isCompleted)

  // Check if schedule is completed
  // Gracefully handle if scheduleCompleted field doesn't exist yet
  let rbtProfile: { scheduleCompleted?: boolean } | null = null
  try {
    rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id: user.rbtProfileId },
      select: { scheduleCompleted: true },
    })
  } catch (error: any) {
    // If scheduleCompleted column doesn't exist or query fails, treat as not completed
    logError('Failed to check schedule completion status', error)
    rbtProfile = { scheduleCompleted: false }
  }

  // Show onboarding tasks if not all completed
  if (!allTasksCompleted) {
    try {
      return <OnboardingDashboard rbtProfileId={user.rbtProfileId} />
    } catch (error) {
      logError('Failed to render OnboardingDashboard', error)
      return (
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-bold text-red-800 mb-2">Error Loading Onboarding</h1>
            <p className="text-red-700">
              Unable to load the onboarding dashboard. Please try refreshing the page.
            </p>
          </div>
        </div>
      )
    }
  }

  // Show schedule setup if tasks are done but schedule is not
  // Use wrapper component to handle the onComplete callback (Client Component)
  if (!rbtProfile?.scheduleCompleted) {
    try {
      return <ScheduleSetupWrapper rbtProfileId={user.rbtProfileId} />
    } catch (error) {
      logError('Failed to render ScheduleSetupWrapper', error)
      return (
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-bold text-red-800 mb-2">Error Loading Schedule Setup</h1>
            <p className="text-red-700">
              Unable to load the schedule setup. Please try refreshing the page.
            </p>
          </div>
        </div>
      )
    }
  }

  // Main dashboard
  try {
    return <RBTMainDashboard rbtProfileId={user.rbtProfileId} />
  } catch (error) {
    logError('Failed to render RBTMainDashboard', error)
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-2">Error Loading Dashboard</h1>
          <p className="text-red-700">
            Unable to load your dashboard. Please try refreshing the page.
          </p>
          <p className="text-sm text-red-600 mt-2">
            If this problem persists, please contact support.
          </p>
        </div>
      </div>
    )
  }
}

