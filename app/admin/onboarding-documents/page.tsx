import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import OnboardingDocumentsAdmin from '@/components/admin/OnboardingDocumentsAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OnboardingDocumentsAdminPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  const user = await validateSession(sessionToken)
  if (!user || user.role !== 'ADMIN') {
    redirect('/')
  }

  const documents = await prisma.onboardingDocument.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  return <OnboardingDocumentsAdmin initialDocuments={documents} />
}

