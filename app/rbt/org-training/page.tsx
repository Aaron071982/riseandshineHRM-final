import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchUserCrmRoles } from '@/lib/crm/access'
import { listAssignedModulesForUser } from '@/lib/org-training/load'
import OrgTrainingModuleList from '@/components/org-training/OrgTrainingModuleList'

export const dynamic = 'force-dynamic'

export default async function RbtOrgTrainingPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/')

  const user = await validateSession(token)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    select: { status: true },
  })
  if (
    !profile ||
    (profile.status !== 'HIRED' && profile.status !== 'ONBOARDING_COMPLETED')
  ) {
    redirect('/rbt/dashboard')
  }

  const crmRoles = await fetchUserCrmRoles(user.id)
  const modules = await listAssignedModulesForUser({
    id: user.id,
    role: user.role,
    crmRoles,
  })

  return (
    <OrgTrainingModuleList
      modules={modules}
      basePath="/rbt/org-training"
      title="Training"
      subtitle="Company training assigned to your role."
    />
  )
}
