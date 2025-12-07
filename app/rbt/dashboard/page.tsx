import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import OnboardingDashboard from '@/components/rbt/OnboardingDashboard'
import RBTMainDashboard from '@/components/rbt/RBTMainDashboard'

export default async function RBTDashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  const user = await validateSession(sessionToken)
  if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
    redirect('/')
  }

  // Check if onboarding is complete
  const onboardingTasks = await prisma.onboardingTask.findMany({
    where: {
      rbtProfileId: user.rbtProfileId,
    },
    orderBy: {
      sortOrder: 'asc',
    },
  })

  // If no tasks exist but RBT is hired, create them (safety check)
  if (onboardingTasks.length === 0) {
    // Auto-create tasks if missing (shouldn't happen, but safety net)
    try {
      const rbtProfile = await prisma.rBTProfile.findUnique({
        where: { id: user.rbtProfileId },
      })
      
      if (rbtProfile && rbtProfile.status === 'HIRED') {
        console.log(`⚠️ RBT ${user.rbtProfileId} is HIRED but has no tasks. Creating them now...`)
        
        const tasks = [
          { taskType: 'DOWNLOAD_DOC', title: 'Download HIPAA Basics PDF', description: 'Download and review the HIPAA Basics for Providers document from CMS', documentDownloadUrl: 'https://www.cms.gov/files/document/mln909001-hipaa-basics-providers-privacy-security-breach-notification-rules.pdf', sortOrder: 1 },
          { taskType: 'DOWNLOAD_DOC', title: 'Review HHS HIPAA Portal', description: 'Review the HHS HIPAA for Professionals portal for comprehensive information', documentDownloadUrl: 'https://www.hhs.gov/hipaa/for-professionals/index.html', sortOrder: 2 },
          { taskType: 'DOWNLOAD_DOC', title: 'Download Confidentiality Agreement Templates', description: 'Download and review the HIPAA Confidentiality Agreement templates', documentDownloadUrl: 'https://www.sampleforms.com/hipaa-confidentiality-agreement-forms.html', sortOrder: 3 },
          { taskType: 'DOWNLOAD_DOC', title: 'Download Onboarding Documents Folder', description: 'Download the complete onboarding documents folder. You will need to fill out all documents and re-upload them as a folder after logging in.', documentDownloadUrl: '/api/rbt/onboarding-package/download', sortOrder: 4 },
          { taskType: 'SIGNATURE', title: 'Digital Signature Confirmation', description: 'Sign to confirm you have read and understood all HIPAA documents and training materials', sortOrder: 5 },
          { taskType: 'PACKAGE_UPLOAD', title: 'Upload Completed Onboarding Documents', description: 'Upload all completed onboarding documents as a folder. You can select multiple files at once. All files will be sent to the administrator for review.', sortOrder: 6 },
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
      console.error('Error auto-creating onboarding tasks:', error)
      // Continue to show onboarding dashboard anyway
    }
  }

  const allTasksCompleted = onboardingTasks.length > 0 && onboardingTasks.every((task) => task.isCompleted)

  if (!allTasksCompleted) {
    return <OnboardingDashboard rbtProfileId={user.rbtProfileId} />
  }

  return <RBTMainDashboard rbtProfileId={user.rbtProfileId} />
}

