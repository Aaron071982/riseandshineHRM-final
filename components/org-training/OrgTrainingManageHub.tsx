import Link from 'next/link'
import { GraduationCap, Plus, Table2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import OrgTrainingModuleList from '@/components/org-training/OrgTrainingModuleList'
import type { OrgTrainingAssignedModule, OrgTrainingModuleListItem } from '@/lib/org-training/load'
import type { AudienceTrainingSummary } from '@/lib/org-training/rbtSummary'

export default function OrgTrainingManageHub({
  canManage,
  canViewMatrix,
  modules,
  myModules,
  summaries,
  createModuleAction,
  error,
}: {
  canManage: boolean
  canViewMatrix: boolean
  modules: OrgTrainingModuleListItem[]
  myModules: OrgTrainingAssignedModule[]
  summaries: AudienceTrainingSummary[]
  createModuleAction?: () => Promise<void>
  error?: string | null
}) {
  const rbt = summaries.find((s) => s.audienceKey === 'RBT')

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
            <GraduationCap className="h-7 w-7 text-[var(--brand)]" />
            Training
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-quiet">
            {canManage
              ? 'Create modules for departments and RBTs, track who finished them, and take any training assigned to your own roles.'
              : 'Complete training modules assigned to your CRM and user roles.'}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {canViewMatrix ? (
              <Button asChild variant="outline">
                <Link href="/client-services/training/matrix">
                  <Table2 className="mr-2 h-4 w-4" />
                  Completion matrix
                </Link>
              </Button>
            ) : null}
            {createModuleAction ? (
              <form action={createModuleAction}>
                <Button type="submit">
                  <Plus className="mr-2 h-4 w-4" />
                  New module (defaults to RBTs)
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <>
          {rbt ? (
            <Card className="border-[var(--brand)]/25 bg-[var(--sunrise-soft)]/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">RBT training progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>{rbt.peopleFullyComplete}</strong> of{' '}
                  <strong>{rbt.peopleAssigned}</strong> RBTs finished all required
                  modules · <strong>{rbt.moduleCount}</strong> active module
                  {rbt.moduleCount === 1 ? '' : 's'} targeting RBTs
                </p>
                <ul className="space-y-1.5">
                  {rbt.modules.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/client-services/training/manage/${m.id}`}
                        className="font-medium text-[var(--brand)] hover:underline"
                      >
                        {m.title}
                        {m.required ? (
                          <span className="ml-2 text-xs text-quiet">Required</span>
                        ) : null}
                      </Link>
                      <span className="tabular-nums text-quiet">
                        {m.completedPeople}/{m.assignedPeople} complete
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {summaries.filter((s) => s.audienceKey !== 'RBT').length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-ink">
                By department / role
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {summaries
                  .filter((s) => s.audienceKey !== 'RBT')
                  .map((s) => (
                    <Card key={s.audienceKey}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{s.label}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-quiet">
                        <p className="mb-2">
                          {s.peopleFullyComplete}/{s.peopleAssigned} people done ·{' '}
                          {s.moduleCount} module{s.moduleCount === 1 ? '' : 's'}
                        </p>
                        <ul className="space-y-1">
                          {s.modules.slice(0, 4).map((m) => (
                            <li key={m.id}>
                              <Link
                                href={`/client-services/training/manage/${m.id}`}
                                className="text-[var(--brand)] hover:underline"
                              >
                                {m.title}
                              </Link>{' '}
                              · {m.completedPeople}/{m.assignedPeople}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-ink">
              All modules ({modules.length})
            </h2>
            <Card>
              <CardContent className="p-0">
                {modules.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-quiet">
                    No modules yet. Create one and check <strong>RBT</strong> (or a
                    department) under Audience so people see it.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {modules.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/client-services/training/manage/${m.id}`}
                          className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-[var(--sunrise-soft)]/50"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-ink">{m.title}</p>
                            <p className="mt-0.5 text-xs text-quiet">
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
          </section>
        </>
      ) : null}

      <section className="space-y-3 border-t border-line pt-8">
        <h2 className="font-display text-lg font-semibold text-ink">My training</h2>
        <OrgTrainingModuleList
          modules={myModules}
          basePath="/client-services/training"
          emptyMessage="No modules assigned to your roles. Managers assign by checking Audience roles on a module (e.g. Intake, Staffing)."
          hideHeader
        />
      </section>
    </div>
  )
}
