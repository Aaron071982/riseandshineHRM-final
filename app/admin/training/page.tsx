import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GraduationCap, Plus, Table2 } from 'lucide-react'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { listAllModulesForAdmin } from '@/lib/org-training/load'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createOrgTrainingModule } from '@/lib/org-training/actions'

export const dynamic = 'force-dynamic'

async function createModuleAction() {
  'use server'
  const result = await createOrgTrainingModule({
    title: 'New training module',
    audienceRoles: ['RBT'],
    required: true,
  })
  if (!result.ok) {
    redirect('/admin/training?error=' + encodeURIComponent(result.error))
  }
  redirect(`/admin/training/${result.data.id}`)
}

export default async function AdminTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (!isAdmin(user)) redirect('/login')

  const modules = await listAllModulesForAdmin()
  const params = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-[#e36f1e]" />
            Org training
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-[var(--text-secondary)]">
            Company-wide modules assigned by role. Distinct from CRM checklist training.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/training/matrix">
              <Table2 className="mr-2 h-4 w-4" />
              Completion matrix
            </Link>
          </Button>
          <form action={createModuleAction}>
            <Button type="submit">
              <Plus className="mr-2 h-4 w-4" />
              New module
            </Button>
          </form>
        </div>
      </div>

      {params.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {params.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modules ({modules.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {modules.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-gray-500">No modules yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-[var(--border-subtle)]">
              {modules.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/training/${m.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-orange-50/50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                        {m.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {m.itemCount} item{m.itemCount === 1 ? '' : 's'}
                        {m.hasQuiz ? ' · quiz' : ''}
                        {' · '}
                        {m.audienceRoles.join(', ') || 'no audience'}
                        {' · '}
                        {m.completionCount} completion
                        {m.completionCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.required ? (
                        <Badge variant="secondary">Required</Badge>
                      ) : (
                        <Badge variant="outline">Optional</Badge>
                      )}
                      <Badge
                        variant={m.status === 'ACTIVE' ? 'default' : 'outline'}
                      >
                        {m.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
