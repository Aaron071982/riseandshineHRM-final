import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FORTY_HOUR_RBT_CERTIFICATE_SLUG } from '@/lib/onboarding/catalog'
import { ensureOnboardingCompletionsForRbt } from '@/lib/onboarding/progress'
import { seedOnboardingCatalog } from '@/lib/onboarding/provision'
import FortyHourTrainingClient from '@/components/rbt/FortyHourTrainingClient'

export const dynamic = 'force-dynamic'

export default async function RbtFortyHourTrainingPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  if (!sessionToken) redirect('/')

  const user = await validateSession(sessionToken)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  try {
    await seedOnboardingCatalog()
    await ensureOnboardingCompletionsForRbt(user.rbtProfileId)
  } catch (e) {
    console.error('[rbt/training] onboarding provision failed', e)
  }

  const [profile, document] = await Promise.all([
    prisma.rBTProfile.findUnique({
      where: { id: user.rbtProfileId },
      select: { fortyHourCourseCompleted: true },
    }),
    prisma.onboardingDocument.findUnique({
      where: { slug: FORTY_HOUR_RBT_CERTIFICATE_SLUG },
      select: { id: true },
    }),
  ])

  const completion = document
    ? await prisma.onboardingCompletion.findUnique({
        where: {
          rbtProfileId_documentId: {
            rbtProfileId: user.rbtProfileId,
            documentId: document.id,
          },
        },
        select: { status: true },
      })
    : null

  const alreadyComplete =
    profile?.fortyHourCourseCompleted === true || completion?.status === 'COMPLETED'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8 text-[#e36f1e]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            40-hour RBT course
          </h1>
          <p className="text-sm text-gray-500">
            Step 1 of onboarding — required for certification and client work
          </p>
        </div>
      </div>
      <FortyHourTrainingClient
        documentId={document?.id ?? null}
        alreadyComplete={alreadyComplete}
      />
    </div>
  )
}
