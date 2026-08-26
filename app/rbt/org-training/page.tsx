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
      <div className="mx-auto max-w-3xl py-8">
        <div className="border-2 border-amber-300 bg-amber-50 px-5 py-6">
          <h1 className="text-2xl font-bold text-amber-950">Training</h1>
          <p className="mt-3 text-sm text-amber-900">
            Training unlocks once you are hired. Finish onboarding paperwork and
            check back — required modules show here as tasks before you start
            sessions.
          </p>
        </div>
      </div>
    )
  }

  const modules = await listAssignedModulesForUser({
    id: user.id,
    role: user.role,
  })

  return (
    <OrgTrainingModuleList
      modules={modules}
      basePath="/rbt/org-training"
      title="Training"
      subtitle="Complete each module below. Tap Start & complete, go through the material, then mark it done."
      emptyMessage="No training assigned yet. When Rise & Shine uploads modules for RBTs, they will appear here."
    />
  )
}
