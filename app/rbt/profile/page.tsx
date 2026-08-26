import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listAssignedModulesForUser } from '@/lib/org-training/load'
import RBTProfileView from '@/components/rbt/RBTProfileView'
import OrgTrainingModuleList from '@/components/org-training/OrgTrainingModuleList'

export const dynamic = 'force-dynamic'

export default async function RBTProfilePage() {
  const user = await getCurrentUser()

  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    include: {
      availabilitySlots: true,
      user: {
        include: {
          profile: {
            select: {
              startDate: true,
              rbtCertificationNumber: true,
              rbtCertificationExpiresAt: true,
            },
          },
        },
      },
    },
  })

  if (!profile) {
    redirect('/')
  }

  const trainingUnlocked =
    profile.status === 'HIRED' || profile.status === 'ONBOARDING_COMPLETED'

  const trainingModules = trainingUnlocked
    ? await listAssignedModulesForUser({
        id: user.id,
        role: user.role,
      })
    : []

  return (
    <div className="space-y-8 pb-10">
      <RBTProfileView profile={profile} />
      <section id="training" className="max-w-2xl mx-auto scroll-mt-20">
        <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
          Training
        </h2>
        {!trainingUnlocked ? (
          <p className="rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Training unlocks after you are hired. Required modules will show here
            and on Home as tasks to finish before the job.
          </p>
        ) : (
          <OrgTrainingModuleList
            modules={trainingModules}
            basePath="/rbt/org-training"
            emptyMessage="No training modules assigned to your role yet."
            hideHeader
          />
        )}
      </section>
    </div>
  )
}
