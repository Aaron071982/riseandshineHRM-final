import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getClientServicesUser } from '@/lib/crm/access'
import { canAuthorOrgTraining } from '@/lib/org-training/access'
import { loadModuleDetail } from '@/lib/org-training/load'
import OrgTrainingModuleEditor from '@/components/admin/OrgTrainingModuleEditor'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function ClientServicesTrainingManagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessionUser = await getCurrentUser()
  const crmUser = await getClientServicesUser()
  if (!canAuthorOrgTraining(sessionUser, crmUser)) {
    redirect('/client-services/training')
  }

  const { id } = await params
  const trainingModule = await loadModuleDetail(id)
  if (!trainingModule) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/client-services/training">← All training</Link>
      </Button>
      <p className="text-sm text-quiet">
        Check <strong>RBT</strong> under Audience so hired therapists see this in
        their portal. Department boxes (Intake, Staffing, …) assign CRM staff.
      </p>
      <OrgTrainingModuleEditor
        key={`${trainingModule.id}-${String(trainingModule.updatedAt)}`}
        module={trainingModule}
        listHref="/client-services/training"
      />
    </div>
  )
}
