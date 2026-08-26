import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { loadModuleDetail } from '@/lib/org-training/load'
import OrgTrainingModuleEditor from '@/components/admin/OrgTrainingModuleEditor'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function AdminTrainingModulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!isAdmin(user)) redirect('/login')

  const { id } = await params
  const module = await loadModuleDetail(id)
  if (!module) redirect('/admin/training')

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/training">← All modules</Link>
      </Button>
      <OrgTrainingModuleEditor
        key={`${module.id}-${String(module.updatedAt)}`}
        module={module}
      />
    </div>
  )
}
