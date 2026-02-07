import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import OnboardingDocumentsAdmin from '@/components/admin/OnboardingDocumentsAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function OnboardingDocsError() {
  return (
    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)] p-6 text-center">
      <p className="font-semibold text-amber-900 dark:text-[var(--status-warning-text)]">Could not load onboarding documents</p>
      <p className="text-sm text-amber-700 dark:text-[var(--status-warning-text)] mt-2">Try refreshing the page.</p>
    </div>
  )
}

export default async function OnboardingDocumentsAdminPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/login')
  }

  const user = await validateSession(sessionToken)
  if (!user || user.role !== 'ADMIN') {
    redirect('/login')
  }

  let documents: Awaited<ReturnType<typeof prisma.onboardingDocument.findMany>>
  try {
    documents = await prisma.onboardingDocument.findMany({
      orderBy: { sortOrder: 'asc' },
    })
  } catch (error) {
    console.error('Admin onboarding-documents: failed to load', error)
    return (
      <div className="space-y-6">
        <div className="pb-6 border-b dark:border-[var(--border-subtle)]">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Onboarding Documents</h1>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)]">Manage onboarding document templates</p>
        </div>
        <OnboardingDocsError />
      </div>
    )
  }

  return <OnboardingDocumentsAdmin initialDocuments={documents} />
}

