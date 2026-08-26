import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listAssignedModulesForUser } from '@/lib/org-training/load'
import OrgTrainingModuleList from '@/components/org-training/OrgTrainingModuleList'

export const dynamic = 'force-dynamic'

export default async function RbtOrgTrainingListPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/')

  const user = await validateSession(token)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    select: { status: true, firstName: true },
  })
  if (!profile || profile.status === 'FIRED') redirect('/')

  const unlocked =
    profile.status === 'HIRED' || profile.status === 'ONBOARDING_COMPLETED'

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
          Company training
        </h1>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Company training unlocks once you are hired. Finish onboarding paperwork
          and check back here — required modules show up as tasks before you start
          sessions.
        </p>
      </div>
    )
  }

  const modules = await listAssignedModulesForUser({
    id: user.id,
    role: user.role,
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <OrgTrainingModuleList
        modules={modules}
        basePath="/rbt/org-training"
        title="Company training"
        subtitle="Required modules from Rise & Shine — complete these before you take on more sessions."
        emptyMessage="No company training assigned yet. When HR uploads modules for RBTs, they will appear here."
      />
    </div>
  )
}
