import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getClientServicesUser } from '@/lib/crm/access'
import { canViewOrgTrainingMatrix } from '@/lib/org-training/access'
import {
  buildOrgTrainingMatrix,
  orgTrainingMatrixToCsv,
} from '@/lib/org-training/matrix'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function ClientServicesTrainingMatrixPage() {
  const sessionUser = await getCurrentUser()
  const crmUser = await getClientServicesUser()
  if (!canViewOrgTrainingMatrix(sessionUser, crmUser)) {
    redirect('/client-services/training')
  }

  const matrix = await buildOrgTrainingMatrix()
  const csv = orgTrainingMatrixToCsv(matrix)
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/client-services/training">← Training</Link>
          </Button>
          <h1 className="text-2xl font-bold text-ink">Training completion matrix</h1>
          <p className="mt-1 text-sm text-quiet">
            Required active modules × assigned people (RBTs and CRM roles).
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={csvHref} download="org-training-matrix.csv">
            Download CSV
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {matrix.people.length} people · {matrix.modules.length} modules
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {matrix.modules.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-quiet">
              No required active modules. Create a module, mark it Required, and
              check RBT or a department under Audience.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-line-2/40">
                  <th className="sticky left-0 bg-surface px-4 py-3 font-medium">
                    Person
                  </th>
                  {matrix.modules.map((m) => (
                    <th
                      key={m.id}
                      className="max-w-[10rem] truncate px-3 py-3 font-medium"
                      title={m.title}
                    >
                      {m.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.people.map((p, i) => (
                  <tr key={p.userId} className="border-b border-line">
                    <td className="sticky left-0 bg-surface px-4 py-2">
                      <div className="font-medium">{p.name || p.email || p.userId}</div>
                      <div className="text-xs text-quiet">
                        {p.role}
                        {p.crmRoles.length ? ` · ${p.crmRoles.join(', ')}` : ''}
                      </div>
                    </td>
                    {(matrix.cells[i] ?? []).map((cell, j) => (
                      <td key={matrix.modules[j]?.id ?? j} className="px-3 py-2">
                        {cell === 'complete' ? (
                          <span className="text-emerald-600">Done</span>
                        ) : cell === 'outstanding' ? (
                          <span className="text-amber-600">Open</span>
                        ) : (
                          <span className="text-quiet/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
